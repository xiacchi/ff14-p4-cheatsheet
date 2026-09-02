# FF14 絶妖星乱舞 P4 カンペアプリ

iPhone / iPadの横画面で使用する、GitHub Pages向けの静的Webアプリです。

## 構成

```text
ff14-p4-cheatsheet/
├─ index.html
├─ SPEC.md
├─ README.md
├─ .nojekyll
├─ css/
│  └─ style.css
├─ js/
│  ├─ rules.js
│  └─ app.js
└─ assets/
   └─ icons/
      └─ README.md
```


## GC2の自動補完

入力回数を減らすため、GC1から一意に決まる項目はGC2で自動補完します。

- カオス：GC1が炎ならGC2は水、GC1が水ならGC2は炎
- エクスデス個人デバフ：加速度は2回のGCを通して必ず1回。GC1が雷/水（＝GC1では加速度なし）ならGC2は加速度を自動ON
- エクスデス個人デバフ：GC1が加速度ならGC2の加速度を無効化し、雷/水の2択だけ残す

GC2のカオス真偽・エクスデス真偽は自動補完されません。
自動補完だけではGC2タイマーは開始せず、GC2で最初に手動入力した瞬間から10秒カウントを開始します。

## タイマー変更

`js/app.js`冒頭の以下を変更します。

```js
const CONFIG = {
  gc1Seconds: 10,
  gc2Seconds: 10,
};
```

例：GC1を8秒、GC2を12秒にする場合：

```js
const CONFIG = {
  gc1Seconds: 8,
  gc2Seconds: 12,
};
```

## アイコン差し替え

`assets/icons/README.md`に記載したファイル名でPNGを配置してください。
画像がなくてもテキスト表示で動作します。

推奨は **256×256px・正方形・背景透過PNG** です。必須サイズではなく、CSSで自動縮小されます。512×512pxでも利用できます。非正方形画像も表示できますが、見かけの大きさを揃えやすいため正方形を推奨します。

## ローカル確認

このバージョンはビルド不要です。`index.html`をブラウザで直接開いても基本動作を確認できます。

ローカルWebサーバーを使う場合：

```bash
python -m http.server 8000
```

その後、ブラウザで `http://localhost:8000/` を開きます。

## GitHub Pagesへのデプロイ（Web画面だけで行う方法）

1. GitHubで新しいリポジトリを作成します。
   - 例：`ff14-p4-cheatsheet`
   - GitHub FreeでPagesを使う場合はPublicリポジトリが分かりやすいです。
2. リポジトリの **Add file → Upload files** を開きます。
3. このフォルダ内のファイル・フォルダをアップロードして、`main`ブランチへCommitします。
4. リポジトリの **Settings → Pages** を開きます。
5. **Build and deployment → Source** で **Deploy from a branch** を選択します。
6. Branchに **main**、Folderに **/(root)** を選び、**Save** を押します。
7. デプロイ完了後、Pages画面に表示される **Visit site** からアクセスします。

通常のプロジェクトPages URLは次の形式です。

```text
https://<GitHubユーザー名>.github.io/<リポジトリ名>/
```

例：リポジトリ名が`ff14-p4-cheatsheet`の場合、URL末尾は`/ff14-p4-cheatsheet/`になります。

## Gitを使ってアップロードする方法

空のGitHubリポジトリを作成した後、このフォルダで以下を実行します。

```bash
git init
git add .
git commit -m "Initial P4 cheatsheet"
git branch -M main
git remote add origin https://github.com/<GitHubユーザー名>/<リポジトリ名>.git
git push -u origin main
```

その後、GitHub上で **Settings → Pages → Deploy from a branch → main / (root)** を設定します。

## 更新方法

ファイルを修正して`main`へPush/Commitすると、GitHub Pages側へ再デプロイされます。

Gitの場合：

```bash
git add .
git commit -m "Adjust P4 cheatsheet"
git push
```

## 修正履歴

- GC2完了後に処理内容画面へ切り替わらない問題を修正（`hidden`属性とCSSの競合を解消）
- GC1から確定できるGC2の炎/水・個人デバフを自動補完
- GC1で加速度が付かなかった場合（雷/水）、GC2の加速度を確定状態として自動ONする仕様を明文化

## 注意

- このアプリは早/遅を判定しません。ゲーム内のデバフ残り時間を確認してください。
- 入力が不足した状態でタイマー切替または完了ボタンを押した場合、結果画面では該当箇所が`未入力`になります。
- 実戦投入前に録画済み動画などでタイマーとUIを必ず確認してください。
