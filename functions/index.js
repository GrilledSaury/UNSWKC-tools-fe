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

      lines.push('BEGIN:VEVENT')
      lines.push(`DTSTART:${fmtIcsUtc(start)}`)
      lines.push(`DTEND:${fmtIcsUtc(end)}`)
      lines.push(`SUMMARY:${escapeIcs(summary)}`)
      if (data.location) lines.push(`LOCATION:${escapeIcs(data.location)}`)
      lines.push(`UID:${d.id}@unswkc`)
      lines.push('END:VEVENT')
    })

    lines.push('END:VCALENDAR')

    res.set('Content-Type', 'text/calendar; charset=utf-8')
    res.set('Cache-Control', 'public, max-age=3600')
    res.send(lines.join('\r\n'))
  } catch (err) {
    res.status(500).send('Error generating calendar')
  }
})
