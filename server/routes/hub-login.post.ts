import { z } from 'zod'

const LoginSchema = z.object({ password: z.string().min(1).max(256) })

export default eventHandler(async (event) => {
  if (!isDirectoryOrigin(event)) {
    setResponseStatus(event, 403)
    return 'Same-origin form submission required'
  }
  const body = await readValidatedBody(event, LoginSchema.parse)
  if (!await logInToDirectory(event, body.password)) {
    setResponseStatus(event, 401)
    return generateDirectoryLoginHtml(event, true)
  }
  return sendRedirect(event, '/', 303)
})
