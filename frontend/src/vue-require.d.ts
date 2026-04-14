/**
 * Vue require 类型声明
 * 解决 Vue 2.6 在 webpack + TypeScript 环境下的 ESM 导入问题
 */

declare module 'vue' {
  const Vue: VueConstructor
  export = Vue
}

declare module 'vuex' {
  const Vuex: {
    install: (vue: any) => void
  }
  export = Vuex
}
