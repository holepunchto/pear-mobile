declare module 'pear-mobile' {
  export default class PearRuntime {
    constructor(config?: object)
    on(event: 'updating' | 'updated', callback: (req: unknown) => void): this
    emit(event: string, ...args: unknown[]): this
    run(filename: string, bundle: unknown, argv: unknown[]): unknown
    applyUpdate(): Promise<void>
  }
}
