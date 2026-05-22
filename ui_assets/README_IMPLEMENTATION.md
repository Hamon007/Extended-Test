# Codex Immortalis UI Assets – Unified RGBA

Dieses Paket enthält die vereinheitlichte Version der 22 UI-Assets.

## Ordner

- `assets_transparent_cropped/`  
  Produktionsordner: PNG-Dateien mit RGBA-Transparenz und zugeschnittenem Außenbereich.

- `assets_original_rgb_backup/`  
  Sicherung der ursprünglichen RGB-Dateien mit schwarzem Hintergrund.

## Implementationsregel

Die PNGs enthalten keine finalen Texte, Zahlen oder Werte.  
Texte, Zahlen, Timer, ATK/DEF, Mana, Prozentwerte, Labels und Füllstände werden durch das Spiel gerendert.

## Balken

Die Bar-Assets sind als leere Tracks gedacht.  
Füllstände sollen als separates Fill-Element im Spiel skaliert werden.

## Spielerkarte

Der Spieler-Kartenrahmen ist innen leer.  
Charakterbild, Name, Seltenheit, Sterne und Werte müssen vom Spiel dynamisch gesetzt werden.

## Badge

Badge-Kreis ist leer.  
Badge-Zahlen werden vom Spiel gesetzt.
