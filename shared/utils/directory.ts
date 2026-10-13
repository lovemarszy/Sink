export interface DirectoryItem {
  slug: string
  title: string
  description: string
  tags: string[]
}

export function filterDirectory(items: DirectoryItem[], query = '', tag = ''): DirectoryItem[] {
  const needle = query.trim().normalize('NFKC').toLowerCase()
  return items.filter(item => (!tag || item.tags.includes(tag))
    && (!needle || [item.title, item.description, item.slug, ...item.tags]
      .some(value => value.normalize('NFKC').toLowerCase().includes(needle))))
    .sort((a, b) => a.title.localeCompare(b.title) || a.slug.localeCompare(b.slug))
}
