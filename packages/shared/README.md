# @mai-kit/shared

mai-kit 各包共享的基础工具与类型。

## MaiKitError

所有包领域错误的统一基类。各包自定义错误继承它，调用方可通过
`instanceof MaiKitError` 统一捕获任意 mai-kit 包抛出的错误。

```ts
import { MaiKitError, isMaiKitError } from "@mai-kit/shared";

throw new MaiKitError("something went wrong", { code: 500 });
```

### 构造

```ts
new MaiKitError(message: string, options?: { code?: number | string; cause?: unknown });
```

- `code`：机器可读的错误码。
- `cause`：原始错误，会写入标准 `Error.cause`。

实例上可读 `message`、`code`、`cause`，`name` 固定为 `"MaiKitError"`。

### 自定义包错误

各包的自定义错误应继承 `MaiKitError`，这样调用方既能用具体错误类型，也能用
`isMaiKitError` / `instanceof MaiKitError` 统一兜底：

```ts
import { MaiKitError } from "@mai-kit/shared";

class MyPackageError extends MaiKitError {
  constructor(message: string, code?: number) {
    super(message, { code });
    this.name = "MyPackageError";
  }
}
```

## maimai 领域原语

各包（database / prober / utils / draw 等）共享的底层类型，集中在此避免重复定义与漂移。

- `SongType`：谱面类型（`"standard" | "dx" | "utage"`）。
- `LevelIndex`：难度索引枚举（`BASIC` … `RE_MASTER`，0–4）。
- `FCType` / `FSType`：FULL COMBO / FULL SYNC 类型码。
- `RateType`：评级码值（`"sssp"` … `"d"`）。
- `CollectionType`：收藏品类型（`"trophy" | "icon" | "plate" | "frame"`）。
- `Collection`：收藏品（也用于玩家装备的称号 / 头像 / 姓名框 / 背景）。
- `CollectionRequired` / `CollectionRequiredSong`：收藏品达成要求。

## 导出

- `MaiKitError` / `isMaiKitError` / `MaiKitErrorOptions`：统一错误基类与工具。
- maimai 领域原语：`SongType`、`LevelIndex`、`FCType`、`FSType`、`RateType`、
  `CollectionType`、`Collection`、`CollectionRequired`、`CollectionRequiredSong`。
