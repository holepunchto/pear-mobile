declare module 'pear-mobile' {
  export default class PearRuntime {
    static run(filename: string, bundle: unknown, argv: unknown[]): unknown
  }
}
