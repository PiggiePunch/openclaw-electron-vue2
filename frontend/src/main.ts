import Vue from 'vue'
import Vuex from 'vuex'
import App from './App.vue'
import store from './store'
import './assets/styles/tailwind.css'

const dpr = window.devicePixelRatio || 1
if (dpr >= 1.5) {
  document.documentElement.setAttribute('data-dpr', dpr.toString())
  if (document.body) {
    ;(document.body as any).webkitFontSmoothing = 'antialiased'
    ;(document.body as any).mozOsxFontSmoothing = 'grayscale'
  }
}

Vue.use(Vuex)

Vue.config.productionTip = false
Vue.config.devtools = process.env.NODE_ENV !== 'production'

new Vue({
  store,
  render: h => h(App)
}).$mount('#app')

if (process.env.NODE_ENV === 'development') {
  console.log('=== VUE APP LOADED ===')
  console.log('Vue version:', Vue.version)
  console.log('Electron API available:', !!(window as any).electronAPI)
  if ((window as any).electronAPI) {
    console.log('Electron API methods:', Object.keys((window as any).electronAPI))
  }
}
