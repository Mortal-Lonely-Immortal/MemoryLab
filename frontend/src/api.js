import axios from 'axios'

const http = axios.create({ baseURL: '/api/v1', timeout: 30000 })

http.interceptors.response.use(
  (res) => {
    const body = res.data
    if (body && typeof body.code !== 'undefined') {
      if (body.code !== 0) throw new Error(body.message || '请求失败')
      return body.data
    }
    return body
  },
  (err) => {
    const msg = err.response?.data?.message || err.message || '网络错误'
    return Promise.reject(new Error(msg))
  }
)

export const api = {
  settings: {
    get: () => http.get('/settings'),
    update: (data) => http.put('/settings', data)
  },
  decks: {
    list: () => http.get('/decks'),
    create: (data) => http.post('/decks', data),
    update: (id, data) => http.put(`/decks/${id}`, data),
    remove: (id) => http.delete(`/decks/${id}`)
  },
  notes: {
    list: (params) => http.get('/notes', { params }),
    get: (id) => http.get(`/notes/${id}`),
    create: (data) => http.post('/notes', data),
    update: (id, data) => http.put(`/notes/${id}`, data),
    remove: (id) => http.delete(`/notes/${id}`)
  },
  cards: {
    page: (params) => http.get('/cards', { params }),
    create: (data) => http.post('/cards', data),
    update: (id, data) => http.put(`/cards/${id}`, data),
    remove: (id) => http.delete(`/cards/${id}`),
    suspend: (id, suspend) => http.post(`/cards/${id}/suspend`, null, { params: { suspend } })
  },
  review: {
    queue: (params) => http.get('/review/queue', { params }),
    score: (id, data) => http.post(`/review/${id}`, data)
  },
  stats: {
    overview: () => http.get('/stats/overview'),
    heatmap: (days = 365) => http.get('/stats/heatmap', { params: { days } }),
    forecast: (days = 30) => http.get('/stats/forecast', { params: { days } }),
    leeches: () => http.get('/stats/leeches'),
    daily: (days = 30) => http.get('/stats/daily', { params: { days } }),
    cardStates: () => http.get('/stats/card-states')
  },
  import: {
    docx: (file) => {
      const fd = new FormData()
      fd.append('file', file)
      return http.post('/import/docx', fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 })
    }
  },
  methodLab: {
    methods: () => http.get('/method-lab/methods'),
    current: () => http.get('/method-lab/plan/current'),
    createPlan: (data) => http.post('/method-lab/plan', data),
    nextDraft: () => http.post('/method-lab/plan/next-draft'),
    score: (data) => http.post('/method-lab/score', data),
    review: (data) => http.post('/method-lab/review', data)
  }
}

export { http }
