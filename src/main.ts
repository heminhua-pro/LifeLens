import { createApp } from 'vue'
import 'ant-design-vue/dist/reset.css'
import './style.css'
import App from './App.vue'

// 组件由 unplugin-vue-components 按需注册，无需 app.use(Antd)
createApp(App).mount('#app')
