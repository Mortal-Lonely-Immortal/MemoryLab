import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', redirect: '/review' },
  { path: '/review', name: 'review', component: () => import('./views/ReviewView.vue'), meta: { title: '今日复习' } },
  { path: '/cards', name: 'cards', component: () => import('./views/CardsView.vue'), meta: { title: '卡片管理' } },
  { path: '/methods', name: 'methods', component: () => import('./views/MethodLabView.vue'), meta: { title: '方法实验室' } },
  { path: '/import', name: 'import', component: () => import('./views/ImportView.vue'), meta: { title: '导入手册' } },
  { path: '/stats', name: 'stats', component: () => import('./views/StatsView.vue'), meta: { title: '统计' } },
  { path: '/settings', name: 'settings', component: () => import('./views/SettingsView.vue'), meta: { title: '设置' } }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.afterEach((to) => {
  document.title = (to.meta.title ? to.meta.title + ' · ' : '') + '记忆实验室'
})

export default router
