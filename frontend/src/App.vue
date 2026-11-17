<script setup>
const nav = [
  { to: '/review', label: '今日复习' },
  { to: '/cards', label: '卡片管理' },
  { to: '/methods', label: '方法实验室' },
  { to: '/import', label: '导入手册' },
  { to: '/stats', label: '统计' },
  { to: '/settings', label: '设置' }
]
</script>

<template>
  <div class="shell">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">记</div>
        <div class="brand-name">记忆实验室</div>
      </div>
      <nav class="nav">
        <router-link v-for="item in nav" :key="item.to" :to="item.to" class="nav-item">
          {{ item.label }}
        </router-link>
      </nav>
    </aside>
    <main class="main">
      <router-view />
    </main>
  </div>
</template>
