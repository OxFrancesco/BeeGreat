import { Sandbox } from '@cloudflare/sandbox'
export { Sandbox }

export class SiteBuildSandbox extends Sandbox {
  override enableInternet = false
}
