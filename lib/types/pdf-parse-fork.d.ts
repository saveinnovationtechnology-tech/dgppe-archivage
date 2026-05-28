declare module 'pdf-parse-fork' {
  function pdfParse(buffer: Buffer, options?: {
    pagerender?: (pageData: any) => string
    max?: number
    version?: string
  }): Promise<{
    text: string
    numpages: number
    numrender: number
    info: any
    metadata: any
    version: string
  }>

  export default pdfParse
}
