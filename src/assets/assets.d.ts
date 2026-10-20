/// <reference types="vite/client" />

// PNG / image dosyalarını string (URL) olarak import etmeye izin verir.
// Vite zaten bunu destekler; bu dosya sadece TypeScript'e bildirir.
declare module '*.png' {
  const src: string
  export default src
}

declare module '*.jpg' {
  const src: string
  export default src
}

declare module '*.jpeg' {
  const src: string
  export default src
}

declare module '*.svg' {
  const src: string
  export default src
}

declare module '*.webp' {
  const src: string
  export default src
}
