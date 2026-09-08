export function initialsOf(fullName) {
  const parts = fullName.trim().split(/\s+/).slice(0, 2)
  return parts.map((part) => part.charAt(0)).join('')
}
