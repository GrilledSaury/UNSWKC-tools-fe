const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { initializeApp }     = require('firebase-admin/app')
const { google }            = require('googleapis')

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
