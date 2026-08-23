import axiosInstance from './axiosInstance'

export interface SearchResult {
  _id: string
  type: string
  title: string
  subtitle: string
  tag: string
  link: string
}

export const adminSearchService = {
  globalSearch: async (query: string): Promise<SearchResult[]> => {
    if (!query) return []
    const response = await axiosInstance.get(`/admin/search?q=${encodeURIComponent(query)}`)
    return response.data
  }
}
