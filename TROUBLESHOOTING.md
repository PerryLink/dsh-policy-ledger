# Troubleshooting — dsh-policy-ledger

每条按「症状 / 原因 / 动作」写。报错原文都是 `<一句人话>（E_XXX）｜下一步：<动作>`，
把 `E_XXX` 和这句话一起发到 issue 即可定位；不要把真实 profile 路径或凭据贴进 issue。

## 1. 路径被拒绝（E_TRUST_PATH_NOT_ALLOWED）

- **症状**：`这个路径不在允许读取的目录里（E_TRUST_PATH_NOT_ALLOWED）｜下一步：把 tarball 放到 DSH_TRUST_INPUT_ROOTS 指定的目录，或在目标目录下运行`
- **原因**：工具只读 `DSH_TRUST_INPUT_ROOTS`（默认当前工作目录）下的文件；传入的路径解析后落在目录之外。
- **动作**：把 `.tgz` 放进允许目录，或在那个目录里启动 DSH；需要多个目录时用系统路径分隔符配置 `DSH_TRUST_INPUT_ROOTS`。

## 2. tarball 不是合法 npm 包（E_TRUST_TARBALL_INVALID / E_TRUST_TARBALL_LIMIT）

- **症状**：`这不是一个能解析的 npm tarball（E_TRUST_TARBALL_INVALID）｜下一步：改用 npm pack 或 pnpm pack 生成的 .tgz，并确认文件没有被截断`
- **原因**：文件不是 gzip、缺少 `package/package.json`，或包内条目超过 5000 个 / 解压后超过上限。
- **动作**：用 `npm pack` 或 `pnpm pack` 重新打包；确认 `.tgz` 能被 `tar -tzf` 列出；超大包请人工复核，不要绕过上限。

## 3. 压缩比异常被拒绝（E_TRUST_ARCHIVE_LIMIT）

- **症状**：`压缩包解压后超过 32 MB 上限，已拒绝继续解压（E_TRUST_ARCHIVE_LIMIT）｜下一步：换一个小一点的 tarball，或只检查官方 registry 下载的包`
- **原因**：gzip 解压后的体积超过 32 MB（可能是正常大包，也可能是 gzip bomb）。
- **动作**：换官方发布的小包；确需检查大包时先人工解压核对内容，不要把上限调大后直接安装。

## Install or activation fails

- DSH must satisfy `>=0.2.1-rc.3 <0.4.0`; Node must be `>=24.9 <25`.
- Run `dsh --version` and `node --version`, then retry with a fresh `DSH_HOME`:

```sh
export DSH_HOME="$(mktemp -d)"
dsh plugin --profile <profile> add dsh-policy-ledger
dsh --profile <profile> --dump-config | grep dsh-policy-ledger
```

## The tool cannot find an input

- All paths are local. Use an absolute path, or a path relative to the process working directory.
- Inputs must resolve under `DSH_TRUST_INPUT_ROOTS` (default: the working directory).
- The shipped quickstart lives in `samples/quickstart/`; it contains a synthetic tarball and install log.

## Parse or encoding failures

- Text inputs must be UTF-8.
- This is a read-only install doctor, not a policy gate. Check that the tarball path is a local, readable `.tgz`.

## Permission or write failures

- `install.bundle` is marked `R1 local write` and writes under `$DSH_HOME/storages/dsh-policy-ledger/bundles`.
- For tests, point `DSH_HOME` at a temporary directory; do not write into a real profile.

## The result looks wrong

- Check the tool boundary in the README first. These are public/synthetic alpha tools, not a production or customer-validated certification.
- The risk level is a declaration-based score, not a proof of safety; review `unknowns` and the snapshot rows.

## Run the tests

```sh
pnpm install --frozen-lockfile
pnpm test
```

## Report

Open an issue on <https://github.com/PerryLink/dsh-policy-ledger/issues> with the package version, a minimal synthetic input, and the exact tool call. Do not attach customer data.
