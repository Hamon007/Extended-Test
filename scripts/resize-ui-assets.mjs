import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { join } from 'path';

const SRC = 'ui_assets/assets_transparent_cropped';
const OUT = 'public/assets/ui';
mkdirSync(OUT, { recursive: true });

// source file → { name, max(longest side) }
const MAP = [
  ['01_asset_back_button.png',                              'back_button',   240],
  ['02_asset_timer_header_frame.png',                       'timer_header',  680],
  ['03_asset_refresh_button.png',                           'refresh_button',200],
  ['04_asset_bar_frame_1.png',                              'bar_stamina',   700],
  ['05_asset_bar_frame_2.png',                              'bar_mana',      700],
  ['06_asset_bar_frame_3.png',                              'bar_exp',       700],
  ['07_asset_bar_frame_4.png',                              'bar_crystal',   700],
  ['08_asset_info_panel.png',                               'info_panel',    720],
  ['09_asset_player_card_frame_empty.png',                  'player_frame',  600],
  ['10_asset_round_icon_button_relics.png',                 'btn_relics',    200],
  ['11_asset_round_icon_button_updates_with_empty_badge.png','btn_updates',  220],
  ['12_asset_status_header_frame.png',                      'status_header', 680],
  ['13_asset_status_row_1.png',                             'status_atk',    680],
  ['14_asset_status_row_2.png',                             'status_def',    680],
  ['15_asset_message_box_frame.png',                        'message_box',   680],
  ['16_asset_section_banner_frame.png',                     'section_banner',680],
  ['17_asset_guide_character.png',                          'guide_character',560],
  ['18_asset_bottom_nav_icon_1.png',                        'nav_guild',     150],
  ['19_asset_bottom_nav_icon_2.png',                        'nav_summon',    150],
  ['20_asset_bottom_nav_icon_3.png',                        'nav_home',      150],
  ['21_asset_bottom_nav_icon_4.png',                        'nav_battle',    150],
  ['22_asset_bottom_nav_icon_5.png',                        'nav_menu',      150],
];

let total = 0;
for (const [src, name, max] of MAP) {
  const out = join(OUT, `${name}.webp`);
  const info = await sharp(join(SRC, src))
    .resize({ width: max, height: max, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82, alphaQuality: 90 })
    .toFile(out);
  total += info.size;
  console.log(`${name}.webp  ${info.width}x${info.height}  ${(info.size/1024).toFixed(1)} KiB`);
}
console.log(`\nGesamt: ${(total/1024).toFixed(1)} KiB`);
