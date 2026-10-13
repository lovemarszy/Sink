export default eventHandler(async (event) => {
  if (!isDirectoryOrigin(event)) {
    setResponseStatus(event, 403)
    return 'Same-origin form submission required'
  }
  await logOutOfDirectory(event)
  return sendRedirect(event, '/', 303)
})
