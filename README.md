# Splattic ARExperiences

Splattic の WebAR 体験一覧と QR コードガイド PDF を管理するプロジェクトです。

## ローカル保存場所（推奨）

Windows の Cursor では、次のフォルダをプロジェクトルートとして開いてください。

```
D:\Cursor\Splattic_ARExperiences\
```

クラウド上のこのリポジトリの内容は、上記フォルダにクローン（または同期）したときと同じ構成になります。

## フォルダ構成

```
Splattic_ARExperiences/
├── assets/              # QRコード・Image Target 画像
├── output/
│   └── AR_Experience_QR_Guide.pdf
├── scripts/
│   ├── generate_ar_pdf.py
│   └── setup-windows.ps1
├── requirements.txt
└── README.md
```

## Windows で初回セットアップ

PowerShell で実行:

```powershell
cd D:\Cursor
git clone https://github.com/kagemushyabot/projects.git Splattic_ARExperiences
cd Splattic_ARExperiences
```

または:

```powershell
.\scripts\setup-windows.ps1
```

Cursor で **File → Open Folder** → `D:\Cursor\Splattic_ARExperiences` を選択します。

## PDF の場所

生成済み PDF:

`D:\Cursor\Splattic_ARExperiences\output\AR_Experience_QR_Guide.pdf`

（リポジトリ内の相対パス: `output/AR_Experience_QR_Guide.pdf`）

## PDF の再生成

```powershell
cd D:\Cursor\Splattic_ARExperiences
python -m pip install -r requirements.txt
python scripts\generate_ar_pdf.py
```

## 掲載 AR 体験

| カテゴリ | 体験 | URL |
|----------|------|-----|
| Slam-Base | box_robo | https://splattic-ar-test-3277b1.gitlab.io/ |
| Slam-Base | splatGarden | https://splat-garden-de068c.gitlab.io/ |
| Slam-Base | TACTIC VideoScreen | https://tactic-sizzle-reel-5611ed.gitlab.io/ |
| Image-base | Tacticbot Dance | https://tacticbot-dance-b22377.gitlab.io/ |
