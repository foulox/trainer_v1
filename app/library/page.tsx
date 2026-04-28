import { fetchLibrary } from '@/lib/sheets'
import LibraryClient from '@/components/LibraryClient'

export default async function LibraryPage() {
  const library = await fetchLibrary()
  return <LibraryClient library={library} />
}
