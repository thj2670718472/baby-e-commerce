import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

import {
  ElAside,
  ElBreadcrumb,
  ElBreadcrumbItem,
  ElButton,
  ElCard,
  ElCheckbox,
  ElCol,
  ElContainer,
  ElDatePicker,
  ElDescriptions,
  ElDescriptionsItem,
  ElDialog,
  ElDivider,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElEmpty,
  ElForm,
  ElFormItem,
  ElHeader,
  ElIcon,
  ElImage,
  ElInput,
  ElInputNumber,
  ElLink,
  ElLoading,
  ElMain,
  ElMenu,
  ElMenuItem,
  ElOption,
  ElPagination,
  ElProgress,
  ElRadio,
  ElRadioGroup,
  ElRate,
  ElRow,
  ElSelect,
  ElSkeleton,
  ElSubMenu,
  ElSwitch,
  ElTable,
  ElTableColumn,
  ElTabPane,
  ElTabs,
  ElTag,
  ElUpload
} from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import './style.css' // TailwindCSS 入口
import axios from 'axios'

const app = createApp(App)

const components = [
  ElAside, ElBreadcrumb, ElBreadcrumbItem, ElButton, ElCard, ElCheckbox, ElCol,
  ElContainer, ElDatePicker, ElDescriptions, ElDescriptionsItem, ElDialog, ElDivider,
  ElDropdown, ElDropdownItem, ElDropdownMenu, ElEmpty, ElForm, ElFormItem, ElHeader,
  ElIcon, ElImage, ElInput, ElInputNumber, ElLink, ElMain, ElMenu, ElMenuItem, ElOption,
  ElPagination, ElProgress, ElRadio, ElRadioGroup, ElRate, ElRow, ElSelect, ElSkeleton,
  ElSubMenu, ElSwitch, ElTable, ElTableColumn, ElTabPane, ElTabs, ElTag, ElUpload
]
for (const component of components) {
  app.component(component.name, component)
}
app.use(ElLoading)

// 注册所有 Element Plus 图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}
app.use(createPinia())
app.use(router)

app.provide('axios', axios)
app.mount('#app')
