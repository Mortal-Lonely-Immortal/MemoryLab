<script setup>
import { onMounted, reactive, ref } from 'vue'
import { api } from '../api'

const decks = ref([])
const cards = ref([])
const total = ref(0)
const page = ref(1)
const size = 20
const loading = ref(false)
const error = ref('')
const filters = reactive({ deckId: '', keyword: '', state: '' })

const showModal = ref(false)
const saving = ref(false)
const form = reactive({ id: null, deckId: '', cardType: 'QA', front: '', back: '', extra: '' })

const stateText = ['新卡', '学习中', '复习', '重学']

async function loadDecks() {
  try {
    decks.value = await api.decks.list()
    if (!form.deckId && decks.value.length) form.deckId = decks.value[0].id
  } catch (e) {
    error.value = e.message
  }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await api.cards.page({
      page: page.value,
      size,
      deckId: filters.deckId || undefined,
      keyword: filters.keyword || undefined,
      state: filters.state === '' ? undefined : filters.state
    })
    cards.value = res.records || []
    total.value = res.total || 0
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function search() {
  page.value = 1
  load()
}

function openCreate() {
  Object.assign(form, {
    id: null,
    deckId: decks.value[0]?.id || '',
    cardType: 'QA',
    front: '',
    back: '',
    extra: ''
  })
  showModal.value = true
}

function openEdit(card) {
  Object.assign(form, {
    id: card.id,
    deckId: card.deckId,
    cardType: card.cardType || 'QA',
    front: card.front,
    back: card.back,
    extra: card.extra || ''
  })
  showModal.value = true
}

async function save() {
  if (!form.front.trim() || !form.back.trim()) {
    error.value = '问题和答案不能为空'
    return
  }
  saving.value = true
  error.value = ''
  try {
    const payload = {
      deckId: Number(form.deckId),
      cardType: form.cardType,
      front: form.front,
      back: form.back,
      extra: form.extra
    }
    if (form.id) await api.cards.update(form.id, payload)
    else await api.cards.create(payload)
    showModal.value = false
    await load()
  } catch (e) {
    error.value = e.message
  } finally {
    saving.value = false
  }
}

async function removeCard(card) {
  if (!confirm('删除这张卡片？')) return
  try {
    await api.cards.remove(card.id)
    await load()
  } catch (e) {
    error.value = e.message
  }
}

async function toggleSuspend(card) {
  try {
    await api.cards.suspend(card.id, !card.suspended)
    await load()
  } catch (e) {
    error.value = e.message
  }
}

function fmtDate(s) {
  if (!s) return '—'
  return s.replace('T', ' ').slice(0, 16)
}

onMounted(async () => {
  await loadDecks()
  await load()
})
</script>

<template>
  <div>
    <div class="page-head">
      <h1 class="page-title">卡片管理<span class="count">{{ total }}</span></h1>
      <button class="btn" @click="openCreate">新建</button>
    </div>

    <div v-if="error" class="error-line">{{ error }}</div>

    <div class="filters">
      <select v-model="filters.deckId" class="input" @change="search">
        <option value="">全部卡组</option>
        <option v-for="d in decks" :key="d.id" :value="d.id">{{ d.name }}</option>
      </select>
      <select v-model="filters.state" class="input" @change="search">
        <option value="">全部状态</option>
        <option :value="0">新卡</option>
        <option :value="2">复习中</option>
        <option :value="1">学习中</option>
        <option :value="3">重学</option>
      </select>
      <input v-model="filters.keyword" class="input grow" placeholder="搜索" @keyup.enter="search" />
    </div>

    <div class="table-wrap">
      <table class="data">
        <thead>
        <tr>
          <th style="width:46%">问题</th>
          <th>类型</th>
          <th>状态</th>
          <th>到期</th>
          <th>复习 / 遗忘</th>
          <th style="width:160px"></th>
        </tr>
        </thead>
        <tbody>
        <tr v-for="c in cards" :key="c.id">
          <td>
            <div class="cell-clip" :title="c.front">{{ c.front }}</div>
            <div class="cell-clip sub" :title="c.back">{{ c.back }}</div>
          </td>
          <td>{{ c.cardType }}</td>
          <td>{{ c.suspended ? '暂停' : stateText[c.state] }}</td>
          <td>{{ fmtDate(c.dueDate) }}</td>
          <td>{{ c.reps }} / {{ c.lapses }}</td>
          <td>
            <div class="actions">
              <button class="btn ghost xs" @click="openEdit(c)">编辑</button>
              <button class="btn ghost xs" @click="toggleSuspend(c)">{{ c.suspended ? '恢复' : '暂停' }}</button>
              <button class="btn ghost xs danger" @click="removeCard(c)">删除</button>
            </div>
          </td>
        </tr>
        <tr v-if="!cards.length && !loading">
          <td colspan="6" class="empty">暂无卡片</td>
        </tr>
        </tbody>
      </table>
    </div>

    <div class="pager">
      <span class="sub">第 {{ page }} 页 / {{ Math.max(1, Math.ceil(total / size)) }} 页</span>
      <button class="btn ghost xs" :disabled="page <= 1" @click="page--; load()">上一页</button>
      <button class="btn ghost xs" :disabled="page * size >= total" @click="page++; load()">下一页</button>
    </div>

    <div v-if="showModal" class="modal-mask" @click.self="showModal = false">
      <div class="modal">
        <h3>{{ form.id ? '编辑卡片' : '新建卡片' }}</h3>
        <div class="grid two">
          <div class="field">
            <label>卡组</label>
            <select v-model="form.deckId" class="input">
              <option v-for="d in decks" :key="d.id" :value="d.id">{{ d.name }}</option>
            </select>
          </div>
          <div class="field">
            <label>类型</label>
            <select v-model="form.cardType" class="input">
              <option value="QA">问答</option>
              <option value="CLOZE">填空</option>
              <option value="WHY">追问</option>
              <option value="MCQ">选择</option>
            </select>
          </div>
        </div>
        <div class="field">
          <label>问题</label>
          <textarea v-model="form.front" class="input"></textarea>
        </div>
        <div class="field">
          <label>答案</label>
          <textarea v-model="form.back" class="input"></textarea>
        </div>
        <div class="field">
          <label>备注</label>
          <input v-model="form.extra" class="input" />
        </div>
        <div class="modal-actions">
          <button class="btn ghost" @click="showModal = false">取消</button>
          <button class="btn" :disabled="saving" @click="save">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>
