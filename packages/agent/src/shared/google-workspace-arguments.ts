import { GOOGLE_COMMAND_FLAGS } from './google-workspace-command-flags'

const GLOBAL_BOOLEAN_FLAGS = ['--help', '-h', '--dry-run', '--noop', '--preview', '--dryrun', '-n', '--force', '--yes', '--assume-yes', '-y']

export type GoogleCommandFile = { name: string; contentBase64: string }

/** Only bytes supplied with this invocation can become file-reading arguments. */
export function prepareGoogleArguments(args: string[], files: readonly GoogleCommandFile[], directory: string): string[] {
  let commandLength = 0
  for (let length = 1; length <= args.length; length++) {
    if (args[length - 1].startsWith('-')) break
    if (GOOGLE_COMMAND_FLAGS[args.slice(0, length).join(' ')]) commandLength = length
  }
  const contract = GOOGLE_COMMAND_FLAGS[args.slice(0, commandLength).join(' ')]
  if (!contract) throw new Error('Choose a supported Google command before its flags.')
  const booleanFlags = new Set([...GLOBAL_BOOLEAN_FLAGS, ...contract.boolean])
  const valueFlags = new Set(contract.value)
  const inputFlags = new Set(contract.input)
  const names = new Set<string>()
  let bytes = 0
  for (const file of files) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,119}$/.test(file.name) || names.has(file.name)) throw new Error('Google input files need unique plain filenames.')
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(file.contentBase64)) throw new Error('Google input file is not valid base64.')
    names.add(file.name)
    bytes += file.contentBase64.length
  }
  if (files.length > 10 || bytes > 7_000_000) throw new Error('Google input files exceed the upload limit.')
  const output: string[] = []
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]
    if (!arg.startsWith('-')) { output.push(arg); continue }
    const equal = arg.indexOf('=')
    const flag = equal < 0 ? arg : arg.slice(0, equal)
    if (booleanFlags.has(flag)) {
      if (equal >= 0 && !['true', 'false'].includes(arg.slice(equal + 1))) throw new Error(`Invalid boolean flag ${flag}.`)
      output.push(arg)
      continue
    }
    if (!valueFlags.has(flag) && !inputFlags.has(flag)) throw new Error(`Google flag ${flag} is not available. Use inline values or staged input files.`)
    const value = equal < 0 ? args[++index] : arg.slice(equal + 1)
    if (value === undefined) throw new Error(`Missing value for ${flag}.`)
    if (inputFlags.has(flag)) {
      if (!names.has(value)) throw new Error(`${flag} must name a file supplied in this tool call.`)
      output.push(`${flag}=${directory}/${value}`)
    } else {
      output.push(`${flag}=${value}`)
    }
  }
  return output
}
