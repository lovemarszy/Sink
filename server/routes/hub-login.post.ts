export default eventHandler(async (event) => {
  if (!isDirectoryOrigin(event)) {
    setResponseStatus(event, 403)
    return 'Same-origin form submission required'
  }
  const password = await readDirectoryLoginPassword(event)
  if (!await logInToDirectory(event, password)) {
    setResponseStatus(event, 401)
    return generateDirectoryLoginHtml(event, true)
  }
  return sendRedirect(event, '/', 303)
})
