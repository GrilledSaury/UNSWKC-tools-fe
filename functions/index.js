const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https')
const { initializeApp }                 = require('firebase-admin/app')
const { getFirestore, Timestamp }       = require('firebase-admin/firestore')
const { google }                        = require('googleapis')

initializeApp()

function gmailClient() {
  const auth = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
  )
  auth.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN })
  return google.gmail({ version: 'v1', auth })
}

function encodeMessage(to, subject, body) {
  const lines = [
    `From: armuror@gmail.com`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Content-Type: text/plain; charset=utf-8`,
    '',
    body,
  ]
  return Buffer.from(lines.join('\r\n')).toString('base64url')
}

exports.sendTestEmail = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in.')

  const gmail = gmailClient()
  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encodeMessage('matthewqiao9270@gmail.com', 'Test email from UNSWKC Functions', 'It works!') },
  })

  return { success: true }
})

function escapeIcs(str) {
  return str.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n')
}

// RFC 5545 §3.1: fold lines longer than 75 octets
function foldLine(line) {
  const buf = Buffer.from(line, 'utf8')
  if (buf.length <= 75) return line
  const parts = []
  let pos = 0
  let first = true
  while (pos < buf.length) {
    const limit = first ? 75 : 74
    parts.push(buf.subarray(pos, pos + limit).toString('utf8'))
    pos += limit
    first = false
  }
  return parts.join('\r\n ')
}

function fmtIcsUtc(date) {
  const p = n => String(n).padStart(2, '0')
  return `${date.getUTCFullYear()}${p(date.getUTCMonth()+1)}${p(date.getUTCDate())}T${p(date.getUTCHours())}${p(date.getUTCMinutes())}00Z`
}

exports.calendarIcs = onRequest({ cors: true }, async (_req, res) => {
  try {
    const db  = getFirestore()
    const now = new Date()
    const past   = new Date(now); past.setDate(past.getDate() - 30)
    const future = new Date(now); future.setFullYear(future.getFullYear() + 1)

    const snap = await db.collection('session')
      .where('start', '>=', Timestamp.fromDate(past))
      .where('start', '<=', Timestamp.fromDate(future))
      .orderBy('start')
      .get()

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//UNSWKC//Training Schedule//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:UNSWKC Training',
    ]

    snap.forEach(d => {
      const data  = d.data()
      const start = (data.trainingStart ?? data.start).toDate()
      const end   = (data.trainingEnd   ?? data.end).toDate()
      const isEvent = data.type === 'event'
      const summary = isEvent
        ? (data.label || 'UNSWKC Event')
        : ('UNSWKC Training' + (data.label ? ` – ${data.label}` : ''))

      const DEFAULT_LOCATION = 'UNSW Fitness & Aquatic Centre (B5), Gate 2, High St, UNSW Sydney, Kensington NSW 2033, Australia'
      const location = data.location || (data.type !== 'event' ? DEFAULT_LOCATION : 'TBD')

      lines.push('BEGIN:VEVENT')
      lines.push(foldLine(`DTSTART:${fmtIcsUtc(start)}`))
      lines.push(foldLine(`DTEND:${fmtIcsUtc(end)}`))
      lines.push(foldLine(`SUMMARY:${escapeIcs(summary)}`))
      lines.push(`LOCATION:${location}`)
      lines.push(foldLine(`UID:${d.id}@unswkc`))
      lines.push('END:VEVENT')
    })

    lines.push('END:VCALENDAR')

    res.set('Content-Type', 'text/calendar; charset=utf-8')
    res.set('Cache-Control', 'private, max-age=3600')
    res.send(lines.join('\r\n') + '\r\n')
  } catch (err) {
    res.status(500).send('Error generating calendar')
  }
})
