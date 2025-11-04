import { useState, useEffect } from 'react'

export interface ShareTokenInfo {
  community_id: string
  name: string
  membership_tier: 'silver' | 'gold'
  content: {
    id: string
    title: string
    description: string
    required_tier: string
    type: string
    author: string
    created_at: string
    tags: string[]
    category: string
    url?: string
    vimeo_video_id?: string
    duration?: number
    file_size?: number
    thumbnail_url?: string
    blog_content?: string
  }[]
}

export const usePublicShare = (token: string) => {
  const [shareInfo, setShareInfo] = useState<ShareTokenInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setError('No share token provided')
      setLoading(false)
      return
    }

    const validateToken = async () => {
      try {
        setLoading(true)
        setError(null)

        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/validate-share-link`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({ token }),
          }
        )

        if (!res.ok) {
          const text = await res.text()
          throw new Error(`Edge function error: ${text || res.statusText}`)
        }

        const data = await res.json()

        if (!data.success) {
          if (data.error?.includes('row-level security')) {
            setError(
              'Access restricted: Your membership level does not allow viewing this content.'
            )
          } else {
            setError(data.error || 'Invalid or disabled share link')
          }
          setShareInfo(null)
          return
        }

        setShareInfo({
          community_id: data.community.id,
          name: data.community.name,
          membership_tier: data.community.membership_tier,
          content: data.content || [],
        })
      } catch (err) {
        console.error('Validation error:', err)
        setError(
          err instanceof Error
            ? err.message
            : 'An unexpected error occurred while validating the share link'
        )
      } finally {
        setLoading(false)
      }
    }

    validateToken()
  }, [token])

  return { shareInfo, loading, error }
}