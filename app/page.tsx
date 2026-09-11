'use client';
/* eslint-disable next/no-html-link-for-pages, next/no-img-element -- Static mascot assets are optimized for this client-only build. */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BatteryCharging,
  BookOpen,
  BookOpenCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock3,
  Code2,
  Coins,
  Cpu,
  ExternalLink,
  Flame,
  Gauge,
  Gem,
  Gift,
  HeartPulse,
  Languages,
  Lightbulb,
  LoaderCircle,
  LockKeyhole,
  Mars,
  Play,
  RotateCcw,
  Search,
  ScanLine,
  Share2,
  ShieldCheck,
  Shield,
  ShoppingBag,
  Sparkles,
  Sword,
  Swords,
  TerminalSquare,
  Target,
  Trophy,
  Venus,
  Waves,
  Wind,
  XCircle,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { WaveformViewer } from '@/components/waveform-viewer';
import { CodeEditor, ReadOnlyCodeBlock } from '@/components/code-editor';
import {
  challenges,
  difficultyLabel,
  kindLabel,
  localize,
  tracks,
  type Locale,
  type TrackId,
} from '@/lib/challenges';
import { formatCodeForEditor } from '@/lib/code-format';
import { gradeXorCnf } from '@/lib/cnf';
import { patternFailures } from '@/lib/pattern-check';
import { learningContext, timingCommandGuide } from '@/lib/learning-context';
import { goldenPatterns } from '@/lib/golden-patterns';
import { speakingChecklist } from '@/lib/readiness';

type Result = {
  ok: boolean;
  phase: 'compile' | 'simulate' | 'pattern' | 'engine' | 'interactive' | 'cnf';
  console: string;
  elapsedMs?: number;
};
type AreaResult = {
  total: number;
  counts: Record<string, number>;
  referenceTotal: number | null;
  elapsedMs: number;
};
type HoldLabState = {
  setup: number;
  hold: number;
  message: string;
  ok: boolean | null;
};
type MascotGender = 'masculine' | 'feminine';
type MascotProfession = 'novice' | 'cpu' | 'soc' | 'dft' | 'timing';
type UnlockableProfession = Exclude<MascotProfession, 'novice'>;
type EquipmentId =
  | 'visor'
  | 'crystal'
  | 'drone'
  | 'cpuBlade'
  | 'cpuShield'
  | 'socQuiver'
  | 'socCompass'
  | 'dftLantern'
  | 'dftProbe'
  | 'timingGrimoire'
  | 'lowPowerCharm';
type EquipmentIconId =
  | 'visor'
  | 'crystal'
  | 'drone'
  | 'sword'
  | 'shield'
  | 'target'
  | 'network'
  | 'healer'
  | 'scan'
  | 'book'
  | 'battery';
type ElementId = 'fire' | 'water' | 'wind' | 'earth';
type ElementLevels = Record<ElementId, number>;
type BattleStatus = 'idle' | 'running' | 'success' | 'failure';
const emptyElementLevels: ElementLevels = { fire: 0, water: 0, wind: 0, earth: 0 };
const storageKeys = {
  schemaVersion: 'soc-rtl-lab:schema-version',
  locale: 'soc-rtl-lab:locale',
  solved: 'soc-rtl-lab:solved',
  code: 'soc-rtl-lab:solutions',
  mascotGender: 'soc-rtl-lab:mascot-gender',
  mascotProfession: 'soc-rtl-lab:mascot-profession',
  ownedEquipment: 'soc-rtl-lab:owned-equipment',
  equippedEquipment: 'soc-rtl-lab:equipped-equipment',
  equipmentSpend: 'soc-rtl-lab:equipment-spend',
  elementLevels: 'soc-rtl-lab:element-levels',
  elementSpend: 'soc-rtl-lab:element-spend',
};
// Public collection links/assets may be kept in the client. Never place API
// credentials or merchant signing secrets in this repository.
const supportConfig = {
  paypalUrl: 'https://paypal.me/424242378',
};
const browserStorage = {
  getItem: (key: string) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* The session remains usable with storage disabled/full. */
    }
  },
};
const initialHoldLab: HoldLabState = {
  setup: 0.12,
  hold: -0.08,
  message: '',
  ok: null,
};

const copy = {
  zh: {
    subtitle: 'RTL、SoC、CDC、DFT 與低功耗實作',
    search: '搜尋題目',
    tracks: '學習路徑',
    all: '全部題目',
    progress: '本機進度',
    points: '分',
    task: '任務',
    constraints: '規格與限制',
    goldenPattern: 'Golden pattern／預期行為',
    goldenPatternNote: '表格描述外部可觀察行為，幫你先確認題意；它不是可直接貼上的 RTL 解答。',
    hint: '使用提示',
    hintsLeft: '次提示可用',
    reset: '重設程式',
    run: '執行測試',
    running: '編譯與測試中…',
    waitingBody: '編譯錯誤、失敗原因與執行時間會顯示在這裡。',
    passed: '全部通過',
    passedBody: '本題已完成，分數與本機進度已更新。',
    failed: '尚未通過',
    engineLoading: '正在準備瀏覽器內執行環境…',
    engineReady: '執行環境已就緒；首次測試會下載編譯器',
    patternReady: '本題使用結構檢查',
    cnfReady: '本題使用瀏覽器內 DIMACS parser 與 DPLL SAT solver',
    interactiveReady: '選擇一個修復動作並觀察 slack 變化',
    testGroups: '檢查項目',
    next: '下一題',
    codeLocal: '程式與進度儲存在此瀏覽器；勿貼上機密或個資',
    independent: '本站為獨立的 SoC 與數位電路實作教學專案。',
    staticNote:
      'GitHub Pages 為靜態網站，測資可被檢視；積分與完成進度目前只保存在本機。',
    ppaTitle: '免安裝的 PPA 快速比較',
    ppaBody:
      '按下按鈕後，Yosys 會直接在瀏覽器內把 Verilog 合成為泛用 cells。它適合比較兩種 RTL 寫法的相對複雜度，但不是製程相關的實際面積。',
    noInstall:
      '不需安裝。執行測試或合成時，從 jsDelivr 載入固定版本的 Icarus／Yosys，運算在瀏覽器內完成；首次使用需要網路。',
    physicalWhy: '為什麼不直接在網頁跑 APR？',
    physicalBody:
      '真實面積、setup/hold slack、繞線壅塞與 DRC 需要公司或製程提供的 Liberty、LEF/PDK、RC corner 與 SDC。ICC2、Innovus、OpenROAD 指令也不同，因此本站用互動實驗教共通概念，不要求背特定工具指令。',
    source: '原始碼',
    noMatch: '找不到符合條件的題目。',
    estimate: 'Yosys 泛用 Cell 統計',
    estimating: 'Yosys 合成中…',
    genericCells: '泛用 cells',
    areaError: 'Yosys 合成失敗',
    whyTitle: '為什麼要學？',
    rolesTitle: '對應工作',
    reference: 'Reference solution',
    userResult: '你的 RTL',
    delta: '差異',
    waveform: '波形',
    commandGuide: '三套 APR 工具指令速查',
    commandCaution:
      '這些是常見流程範例，不是可直接複製到所有專案的完整腳本；請依工具版本、MMMC scenario、PDK 與公司 flow 確認。',
    speaking: '完成後請用自己的話說清楚',
    mascotCustomize: '角色與裝備',
    mascotGender: '企鵝性別',
    masculine: '男企鵝',
    feminine: '女企鵝',
    mascotProfession: '職業解鎖',
    mascotDone: '完成',
    mascotDescription:
      '完成指定領域題目可解鎖並裝備職業；商店商品可直接購買，但職業專屬裝備只能由對應職業使用。消費不會降低總分與等級。',
    wallet: '可用點數',
    equipment: '裝備商店',
    buy: '購買',
    equip: '裝備',
    equipped: '使用中',
    unequip: '卸下',
    owned: '已擁有',
    locked: '尚未解鎖',
    professionRequired: '切換至對應職業後可裝備',
    solvedNeeded: '題完成',
    hintBuddy: '卡住時，我會陪你逐步拆解；先自己推一拍訊號，再使用提示。',
    enchantments: '屬性石附魔',
    enchantmentBody: '每次強化都會提高戰鬥特效強度；集齊火、水、風、土可解鎖四靈根融合特效。',
    enhance: '強化',
    level: '階',
    fourRoots: '四靈根已解鎖',
    battleRunning: '正在攻擊 RTL 稻草人，逐拍檢查你的電路…',
    battleSuccess: '測試命中！所有測資通過。',
    battleFailure: '稻草人擋下攻擊；從第一個 mismatch 開始除錯。',
    mascotInteract: '點企鵝互動',
    support: '贊助開發',
    supportBody: '目前可透過 PayPal.Me 自願支持；款項不會增加遊戲點數，也不是可抵稅的公益捐款。如需其他贊助管道，歡迎透過作者網站聯絡。',
    paypalAction: '透過 PayPal 支持',
    contactSupport: '聯絡作者',
    paidPointsPending: '付費點數尚未開放',
  },
  en: {
    subtitle: 'Hands-on RTL, SoC, CDC, DFT and low-power practice',
    search: 'Search challenges',
    tracks: 'Learning tracks',
    all: 'All challenges',
    progress: 'Local progress',
    points: 'pts',
    task: 'Task',
    constraints: 'Requirements',
    goldenPattern: 'Golden pattern / expected behavior',
    goldenPatternNote: 'This table defines observable behavior so you can confirm the contract before coding. It is not a paste-ready RTL solution.',
    hint: 'Use hint',
    hintsLeft: 'hints left',
    reset: 'Reset code',
    run: 'Run tests',
    running: 'Compiling and testing…',
    waitingBody:
      'Compile errors, failures and execution time will appear here.',
    passed: 'All tests passed',
    passedBody:
      'Challenge completed. Your local score and progress are updated.',
    failed: 'Not passed yet',
    engineLoading: 'Preparing the browser runtime…',
    engineReady: 'Runtime ready; the first test downloads the compiler',
    patternReady: 'This challenge uses structural checks',
    cnfReady:
      'This challenge uses an in-browser DIMACS parser and DPLL SAT solver',
    interactiveReady: 'Choose a repair action and observe the slack change',
    testGroups: 'Test groups',
    next: 'Next challenge',
    codeLocal:
      'Saved in this browser; do not paste confidential or personal data',
    independent:
      'An independent hands-on learning project for SoC and digital circuits.',
    staticNote:
      'GitHub Pages is static, so test assets are inspectable; scores and completion progress are currently local-device only.',
    ppaTitle: 'Zero-install PPA quick comparison',
    ppaBody:
      'Yosys synthesizes Verilog into generic cells directly in the browser. This helps compare the relative complexity of two RTL versions, but it is not process-specific physical area.',
    noInstall:
      'No installation needed. Tests/synthesis download pinned Icarus/Yosys versions from jsDelivr and run in your browser. First use requires a network connection.',
    physicalWhy: 'Why not run APR directly in the browser?',
    physicalBody:
      'Real area, setup/hold slack, congestion, and DRC require process or company Liberty, LEF/PDK, RC corners, and SDC. ICC2, Innovus, and OpenROAD commands also differ, so this site teaches shared concepts through interactive labs instead of vendor-specific command memorization.',
    source: 'Source',
    noMatch: 'No challenge matches the current filters.',
    estimate: 'Yosys generic cell count',
    estimating: 'Synthesizing with Yosys…',
    genericCells: 'generic cells',
    areaError: 'Yosys synthesis failed',
    whyTitle: 'Why it matters',
    rolesTitle: 'Related roles',
    reference: 'Reference solution',
    userResult: 'Your RTL',
    delta: 'Delta',
    waveform: 'Waveform',
    commandGuide: 'APR command quick reference',
    commandCaution:
      'These are common flow examples, not drop-in scripts for every project. Confirm tool release, MMMC scenarios, PDK, and company flow.',
    speaking: 'Explain it in your own words after solving',
    mascotCustomize: 'Character & gear',
    mascotGender: 'Penguin gender',
    masculine: 'Male penguin',
    feminine: 'Female penguin',
    mascotProfession: 'Profession unlocks',
    mascotDone: 'Done',
    mascotDescription:
      'Solve domain challenges to unlock and equip professions. Any affordable shop item can be purchased, but profession gear can only be equipped by its matching class. Spending never reduces your score or rank.',
    wallet: 'Spendable points',
    equipment: 'Equipment shop',
    buy: 'Buy',
    equip: 'Equip',
    equipped: 'Equipped',
    unequip: 'Unequip',
    owned: 'Owned',
    locked: 'Locked',
    professionRequired: 'Switch to the matching profession to equip',
    solvedNeeded: 'solved',
    hintBuddy:
      'When you get stuck, I will help you break it down. Trace one cycle yourself before using a hint.',
    enchantments: 'Element stones',
    enchantmentBody: 'Each upgrade intensifies the visible battle effect. Collect fire, water, wind, and earth to unlock the Four Roots fusion.',
    enhance: 'Enhance',
    level: 'Lv.',
    fourRoots: 'Four Roots unlocked',
    battleRunning: 'Attacking the RTL dummy and checking your design cycle by cycle…',
    battleSuccess: 'Direct hit! Every test passed.',
    battleFailure: 'The dummy blocked the attack. Debug from the first mismatch.',
    mascotInteract: 'Interact with the penguin',
    support: 'Support development',
    supportBody: 'Voluntary support is available through PayPal.Me. Payments do not grant game points and are not tax-deductible charitable donations. Contact the author through the portfolio site if you need another support method.',
    paypalAction: 'Support via PayPal',
    contactSupport: 'Contact the author',
    paidPointsPending: 'Paid points are not available yet',
  },
};

const mascotProfessions: Record<
  MascotProfession,
  {
    title: { zh: string; en: string };
    field: { zh: string; en: string };
    message: { zh: string; en: string };
  }
> = {
  novice: {
    title: { zh: '邏輯學徒', en: 'Logic Apprentice' },
    field: { zh: '尚未選定專精', en: 'Undeclared specialty' },
    message: {
      zh: '完成領域題目，解鎖真正的職業造型。',
      en: 'Solve domain challenges to unlock a true profession.',
    },
  },
  cpu: {
    title: { zh: '電子劍士', en: 'Circuit Swordsman' },
    field: { zh: 'CPU 專家', en: 'CPU Specialist' },
    message: {
      zh: '看清資料相依，再讓每一拍準確前進。',
      en: 'Resolve data dependencies and move every cycle forward precisely.',
    },
  },
  soc: {
    title: { zh: '電子弓箭手', en: 'Circuit Archer' },
    field: { zh: 'SoC 整合專家', en: 'SoC Integration Specialist' },
    message: {
      zh: '瞄準介面、資料流與整合邊界，一箭串起完整系統。',
      en: 'Aim at interfaces, dataflow, and integration boundaries to connect the system.',
    },
  },
  dft: {
    title: { zh: '電子補師', en: 'Silicon Healer' },
    field: { zh: 'DFT 專家', en: 'DFT Specialist' },
    message: {
      zh: '提高可控制性與可觀察性，把故障找出來。',
      en: 'Improve controllability and observability to expose faults.',
    },
  },
  timing: {
    title: { zh: '電子魔法師', en: 'Timing Mage' },
    field: { zh: '時序與低功耗專家', en: 'Timing & Low-Power Specialist' },
    message: {
      zh: '掌握 clock、slack 與功耗之間的平衡。',
      en: 'Balance clocks, slack, and power.',
    },
  },
};

const professionUnlocks: Record<
  UnlockableProfession,
  { tracks: TrackId[]; required: number }
> = {
  cpu: { tracks: ['cpu-cache'], required: 3 },
  soc: { tracks: ['soc'], required: 3 },
  dft: { tracks: ['dft'], required: 2 },
  timing: { tracks: ['timing', 'low-power'], required: 3 },
};

const equipmentCatalog: Record<
  EquipmentId,
  {
    icon: EquipmentIconId;
    cost: number;
    profession: MascotProfession | 'all';
    name: { zh: string; en: string };
    effect: { zh: string; en: string };
    artwork?: { src: string };
  }
> = {
  visor: {
    icon: 'visor',
    artwork: { src: './mascot/equipment-visor.png' },
    cost: 600,
    profession: 'all',
    name: { zh: 'Debug 護目鏡', en: 'Debug Visor' },
    effect: {
      zh: '陪你看清波形與錯誤訊息。',
      en: 'Helps you inspect waveforms and diagnostics.',
    },
  },
  crystal: {
    icon: 'crystal',
    artwork: { src: './mascot/equipment-crystal.png' },
    cost: 900,
    profession: 'all',
    name: { zh: 'Timing 水晶', en: 'Timing Crystal' },
    effect: {
      zh: '提醒你同時檢查 setup 與 hold。',
      en: 'Reminds you to check both setup and hold.',
    },
  },
  drone: {
    icon: 'drone',
    artwork: { src: './mascot/equipment-drone.png' },
    cost: 1200,
    profession: 'all',
    name: { zh: '晶片夥伴', en: 'Chip Companion' },
    effect: {
      zh: '在 SoC 整合與除錯時並肩偵察。',
      en: 'Scouts beside you during SoC integration and debug.',
    },
  },
  cpuBlade: {
    icon: 'sword', cost: 900, profession: 'cpu',
    name: { zh: 'Forwarding 光刃', en: 'Forwarding Blade' },
    effect: { zh: '把資料相依化成可追蹤的旁路斬擊。', en: 'Turns data dependencies into a traceable bypass strike.' },
  },
  cpuShield: {
    icon: 'shield', cost: 1450, profession: 'cpu',
    name: { zh: 'Pipeline 護盾', en: 'Pipeline Shield' },
    effect: { zh: '提醒你同步檢查 stall、flush 與 valid。', en: 'Keeps stall, flush, and valid aligned during debug.' },
  },
  socQuiver: {
    icon: 'target', cost: 950, profession: 'soc',
    name: { zh: 'AXI 箭匣', en: 'AXI Quiver' },
    effect: { zh: '瞄準 ready／valid、burst 與 backpressure。', en: 'Targets ready/valid, bursts, and backpressure.' },
  },
  socCompass: {
    icon: 'network', cost: 1500, profession: 'soc',
    name: { zh: 'Interconnect 羅盤', en: 'Interconnect Compass' },
    effect: { zh: '沿著 address map 與資料流定位整合錯誤。', en: 'Traces integration faults through address maps and dataflow.' },
  },
  dftLantern: {
    icon: 'healer', cost: 850, profession: 'dft',
    name: { zh: 'Scan 診斷燈', en: 'Scan Diagnostic Lantern' },
    effect: { zh: '照亮可控制性、可觀察性與未知值來源。', en: 'Illuminates controllability, observability, and X sources.' },
  },
  dftProbe: {
    icon: 'scan', cost: 1400, profession: 'dft',
    name: { zh: 'Fault 探針', en: 'Fault Probe' },
    effect: { zh: '追蹤 stuck-at、transition 與 MBIST failure。', en: 'Tracks stuck-at, transition, and MBIST failures.' },
  },
  timingGrimoire: {
    icon: 'book', cost: 1000, profession: 'timing',
    name: { zh: 'STA 魔導書', en: 'STA Grimoire' },
    effect: { zh: '把 clock、constraint 與 path report 串成因果。', en: 'Connects clocks, constraints, and path reports into one cause.' },
  },
  lowPowerCharm: {
    icon: 'battery', cost: 1600, profession: 'timing',
    name: { zh: 'Low-Power 月墜', en: 'Low-Power Moon Charm' },
    effect: { zh: '守護 clock gating、isolation 與 retention 順序。', en: 'Guards clock gating, isolation, and retention sequencing.' },
  },
};

const elementCatalog: Record<
  ElementId,
  { name: { zh: string; en: string }; effect: { zh: string; en: string }; className: string }
> = {
  fire: { name: { zh: '火屬性石', en: 'Fire Stone' }, effect: { zh: '失敗時標亮第一個 mismatch，像熱點一樣聚焦 root cause。', en: 'Highlights the first mismatch like a hotspot around the root cause.' }, className: 'element-fire' },
  water: { name: { zh: '水屬性石', en: 'Water Stone' }, effect: { zh: '讓波形比較更清楚，強調訊號前後週期的流動。', en: 'Clarifies waveform comparison and cycle-to-cycle signal flow.' }, className: 'element-water' },
  wind: { name: { zh: '風屬性石', en: 'Wind Stone' }, effect: { zh: '加強編譯與 regression 的速度感，提醒先縮小失敗範圍。', en: 'Adds regression speed and reminds you to narrow the failing scope.' }, className: 'element-wind' },
  earth: { name: { zh: '土屬性石', en: 'Earth Stone' }, effect: { zh: '強調 assertion、邊界條件與可重現測資的穩定基礎。', en: 'Reinforces assertions, boundaries, and reproducible tests.' }, className: 'element-earth' },
};

const elementUpgradeCost = (level: number) => 450 + level * 350;

function EquipmentIcon({ id, className = '' }: { id: EquipmentIconId; className?: string }) {
  const icons = {
    visor: Search,
    crystal: Gem,
    drone: Cpu,
    sword: Sword,
    shield: Shield,
    target: Target,
    network: Share2,
    healer: HeartPulse,
    scan: ScanLine,
    book: BookOpenCheck,
    battery: BatteryCharging,
  };
  const Icon = icons[id];
  return <Icon className={className} aria-hidden="true" />;
}

function EquipmentArtwork({ src, className = '' }: { src: string; className?: string }) {
  return (
    <img
      src={src}
      alt=""
      width={256}
      height={256}
      loading="lazy"
      decoding="async"
      className={`equipment-artwork ${className}`}
      aria-hidden="true"
    />
  );
}

const mascotTiers = {
  zh: ['見習', '進階', '菁英', '傳奇'],
  en: ['Apprentice', 'Advanced', 'Elite', 'Legendary'],
};

function mascotStageFor(points: number) {
  if (points >= 1300) return 3;
  if (points >= 700) return 2;
  if (points >= 300) return 1;
  return 0;
}

function MascotAvatar({
  gender,
  profession,
  tier,
  equipment = null,
  elements = emptyElementLevels,
  className = '',
}: {
  gender: MascotGender;
  profession: MascotProfession;
  tier: number;
  equipment?: EquipmentId | null;
  elements?: ElementLevels;
  className?: string;
}) {
  const image =
    gender === 'masculine' && profession === 'soc'
      ? './mascot/penguin-masculine-soc-v2.png'
      : `./mascot/penguin-${gender}-${profession}.png`;
  const activeElements = (Object.keys(elements) as ElementId[]).filter(
    (element) => elements[element] > 0,
  );
  const dominantElement = activeElements.reduce<ElementId | null>(
    (best, element) =>
      best === null || elements[element] > elements[best] ? element : best,
    null,
  );
  const equippedItem = equipment ? equipmentCatalog[equipment] : null;
  return (
    <div
      className={`mascot-avatar mascot-tier-${tier} mascot-gender-${gender} mascot-profession-${profession} ${dominantElement ? `mascot-enchanted mascot-enchanted-${dominantElement}` : ''} relative overflow-visible ${className}`}
      aria-label={mascotProfessions[profession].title.en}
    >
      <div className="mascot-character-frame absolute inset-0 overflow-visible">
        <img
          src={image}
          alt=""
          width={360}
          height={480}
          decoding="async"
          className="mascot-character absolute inset-0 h-full w-full object-contain transition-transform duration-500 ease-out"
        />
      </div>
      {dominantElement && <span className="mascot-element-cloak" aria-hidden="true" />}
      <span className="mascot-tier-ornament" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span className="mascot-gender-emblem" aria-hidden="true">
        {gender === 'masculine' ? <Mars /> : <Venus />}
      </span>
      {equipment && equippedItem && (
        <div className={`mascot-equipment mascot-equipment-${equippedItem.profession}`}>
          {equippedItem.artwork ? (
            <EquipmentArtwork src={equippedItem.artwork.src} />
          ) : (
            <EquipmentIcon id={equippedItem.icon} className="mascot-equipment-icon" />
          )}
        </div>
      )}
    </div>
  );
}

function BattleArena({
  gender,
  profession,
  tier,
  equipment,
  elements,
  status,
  isBoss,
}: {
  gender: MascotGender;
  profession: MascotProfession;
  tier: number;
  equipment: EquipmentId | null;
  elements: ElementLevels;
  status: BattleStatus;
  isBoss: boolean;
}) {
  const rootsUnlocked = Object.values(elements).every((level) => level > 0);
  const totalElementLevel = Object.values(elements).reduce((sum, level) => sum + level, 0);
  const activeElements = (Object.keys(elements) as ElementId[]).filter(
    (element) => elements[element] > 0,
  );
  const dominantElement = activeElements.reduce<ElementId | null>(
    (best, element) =>
      best === null || elements[element] > elements[best] ? element : best,
    null,
  );
  const battleStyle = {
    '--effect-level': Math.min(5, Math.max(1, totalElementLevel)),
  } as CSSProperties;

  return (
    <div
      className={`mascot-battle-arena battle-${status} profession-${profession} ${dominantElement ? `battle-element-${dominantElement}` : ''} ${isBoss ? 'boss-battle' : ''} ${rootsUnlocked ? 'four-roots-active' : ''}`}
      style={battleStyle}
      aria-hidden="true"
    >
      <div className="mascot-battle-actor">
        <MascotAvatar
          gender={gender}
          profession={profession}
          tier={tier}
          equipment={equipment}
          elements={elements}
          className="h-[116px] w-[88px] sm:h-[132px] sm:w-[99px]"
        />
      </div>
      <div className="mascot-attack-path" aria-hidden="true">
        <span className="attack-core" />
        <span className="attack-trail attack-trail-a" />
        <span className="attack-trail attack-trail-b" />
        <span className="profession-projectile projectile-a" />
        <span className="profession-projectile projectile-b" />
        <span className="profession-projectile projectile-c" />
        <span className="profession-projectile projectile-d" />
        {activeElements.map((element) => (
          <span
            key={element}
            className={`element-particle ${elementCatalog[element].className}`}
            style={{ '--stone-level': Math.min(5, elements[element]) } as CSSProperties}
          />
        ))}
      </div>
      <div className={`rtl-dummy-wrap ${isBoss ? 'boss-target-wrap' : ''}`} aria-hidden="true">
        <span className="dummy-hit-ring" />
        <img
          src={isBoss ? './mascot/gate-level-timing-boss-display.png' : './mascot/rtl-training-dummy-display.png'}
          alt=""
          width={isBoss ? 560 : 360}
          height={isBoss ? 512 : 360}
          decoding="async"
          className={isBoss ? 'rtl-boss' : 'rtl-dummy'}
        />
        {isBoss && (
          <>
            <span className="boss-shard boss-shard-a" />
            <span className="boss-shard boss-shard-b" />
            <span className="boss-shard boss-shard-c" />
          </>
        )}
        <span className="rtl-dummy-label">{isBoss ? 'BOSS' : 'RTL'}</span>
      </div>
    </div>
  );
}

export default function Home() {
  const [locale, setLocale] = useState<Locale>('zh');
  const [selectedId, setSelectedId] = useState(challenges[0].id);
  const [track, setTrack] = useState<TrackId | 'all'>('all');
  const [query, setQuery] = useState('');
  const [solutions, setSolutions] = useState<Record<string, string>>({});
  const [solved, setSolved] = useState<string[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [running, setRunning] = useState(false);
  const [battleVisible, setBattleVisible] = useState(false);
  const [engineReady, setEngineReady] = useState(false);
  const [revealedHints, setRevealedHints] = useState(0);
  const [holdLab, setHoldLab] = useState<HoldLabState>({ ...initialHoldLab });
  const [areaResult, setAreaResult] = useState<AreaResult | null>(null);
  const [areaError, setAreaError] = useState('');
  const [estimating, setEstimating] = useState(false);
  const [waveformVcd, setWaveformVcd] = useState('');
  const [mascotGender, setMascotGender] = useState<MascotGender>('masculine');
  const [mascotProfession, setMascotProfession] =
    useState<MascotProfession>('novice');
  const [ownedEquipment, setOwnedEquipment] = useState<EquipmentId[]>([]);
  const [equippedEquipment, setEquippedEquipment] =
    useState<EquipmentId | null>(null);
  const [equipmentSpend, setEquipmentSpend] = useState(0);
  const [elementLevels, setElementLevels] = useState<ElementLevels>({
    ...emptyElementLevels,
  });
  const [elementSpend, setElementSpend] = useState(0);
  const [mascotTapNonce, setMascotTapNonce] = useState(0);
  const [mascotInteraction, setMascotInteraction] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const pendingRequest = useRef<string | null>(null);
  const pendingSynth = useRef<string | null>(null);
  const instantJudgeTimer = useRef<number | null>(null);
  const battleReturnTimer = useRef<number | null>(null);
  const storageLoaded = useRef(false);
  const current =
    challenges.find((item) => item.id === selectedId) ?? challenges[0];
  const context = learningContext[current.id];
  const goldenPattern = goldenPatterns[current.id];
  const text = copy[locale];
  const starterCode = useMemo(
    () => formatCodeForEditor(current.starter, current.language),
    [current.starter, current.language],
  );
  const code = solutions[current.id] ?? starterCode;

  const startBattle = useCallback(() => {
    if (battleReturnTimer.current !== null)
      window.clearTimeout(battleReturnTimer.current);
    battleReturnTimer.current = null;
    setBattleVisible(true);
  }, []);

  const scheduleMascotReturn = useCallback(() => {
    if (battleReturnTimer.current !== null)
      window.clearTimeout(battleReturnTimer.current);
    battleReturnTimer.current = window.setTimeout(() => {
      setBattleVisible(false);
      battleReturnTimer.current = null;
    }, 1400);
  }, []);

  const markSolved = useCallback((id: string) => {
    setSolved((previous) => {
      if (previous.includes(id)) return previous;
      const next = [...previous, id];
      browserStorage.setItem(storageKeys.solved, JSON.stringify(next));
      return next;
    });
  }, []);

  const selectChallenge = useCallback((id: string) => {
    if (!challenges.some((item) => item.id === id)) return false;
    pendingRequest.current = null;
    pendingSynth.current = null;
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'SOC_RTL_CANCEL' },
      window.location.origin,
    );
    setRunning(false);
    setBattleVisible(false);
    setEstimating(false);
    setSelectedId(id);
    setResult(null);
    setWaveformVcd('');
    setAreaResult(null);
    setAreaError('');
    setRevealedHints(0);
    setHoldLab({ ...initialHoldLab });
    setMascotInteraction('');
    if (instantJudgeTimer.current !== null) {
      window.clearTimeout(instantJudgeTimer.current);
      instantJudgeTimer.current = null;
    }
    if (battleReturnTimer.current !== null) {
      window.clearTimeout(battleReturnTimer.current);
      battleReturnTimer.current = null;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return true;
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const savedLocale = browserStorage.getItem(
        storageKeys.locale,
      ) as Locale | null;
      const savedSolved = browserStorage.getItem(storageKeys.solved);
      const savedSolutions = browserStorage.getItem(storageKeys.code);
      const savedMascotGender = browserStorage.getItem(
        storageKeys.mascotGender,
      );
      const savedMascotProfession = browserStorage.getItem(
        storageKeys.mascotProfession,
      );
      const savedOwnedEquipment = browserStorage.getItem(
        storageKeys.ownedEquipment,
      );
      const savedEquippedEquipment = browserStorage.getItem(
        storageKeys.equippedEquipment,
      );
      const savedEquipmentSpend = browserStorage.getItem(storageKeys.equipmentSpend);
      const savedElementLevels = browserStorage.getItem(storageKeys.elementLevels);
      const savedElementSpend = browserStorage.getItem(storageKeys.elementSpend);
      if (savedLocale === 'zh' || savedLocale === 'en') setLocale(savedLocale);
      if (savedMascotGender === 'masculine' || savedMascotGender === 'feminine')
        setMascotGender(savedMascotGender);
      if (
        savedMascotProfession === 'novice' ||
        savedMascotProfession === 'cpu' ||
        savedMascotProfession === 'soc' ||
        savedMascotProfession === 'dft' ||
        savedMascotProfession === 'timing'
      )
        setMascotProfession(savedMascotProfession);
      try {
        const parsedSolved: unknown = JSON.parse(savedSolved ?? '[]');
        const parsedSolutions: unknown = JSON.parse(savedSolutions ?? '{}');
        const parsedOwnedEquipment: unknown = JSON.parse(
          savedOwnedEquipment ?? '[]',
        );
        const parsedElementLevels: unknown = JSON.parse(
          savedElementLevels ?? JSON.stringify(emptyElementLevels),
        );
        if (Array.isArray(parsedSolved))
          setSolved([
            ...new Set(
              parsedSolved.filter(
                (id) =>
                  typeof id === 'string' &&
                  challenges.some((item) => item.id === id),
              ),
            ),
          ]);
        if (Array.isArray(parsedOwnedEquipment))
          {
            const migratedOwned = [
              ...new Set(
                parsedOwnedEquipment.filter(
                  (id): id is EquipmentId =>
                    typeof id === 'string' && id in equipmentCatalog,
                ),
              ),
            ];
            setOwnedEquipment(migratedOwned);
            const parsedSpend = Number(savedEquipmentSpend);
            if (
              savedEquipmentSpend !== null &&
              Number.isFinite(parsedSpend) &&
              parsedSpend >= 0
            ) {
              setEquipmentSpend(parsedSpend);
            } else {
              const legacyPrices: Partial<Record<EquipmentId, number>> = {
                visor: 120,
                crystal: 220,
                drone: 350,
              };
              setEquipmentSpend(
                migratedOwned.reduce(
                  (sum, id) => sum + (legacyPrices[id] ?? equipmentCatalog[id].cost),
                  0,
                ),
              );
            }
          }
        if (
          savedEquippedEquipment &&
          savedEquippedEquipment in equipmentCatalog
        )
          setEquippedEquipment(savedEquippedEquipment as EquipmentId);
        if (parsedElementLevels && typeof parsedElementLevels === 'object') {
          const migratedElements = (Object.keys(emptyElementLevels) as ElementId[]).reduce(
            (next, element) => {
              const value = Number((parsedElementLevels as Record<string, unknown>)[element]);
              next[element] = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
              return next;
            },
            { ...emptyElementLevels },
          );
          setElementLevels(migratedElements);
          const parsedSpend = Number(savedElementSpend);
          setElementSpend(
            savedElementSpend !== null &&
            Number.isFinite(parsedSpend) && parsedSpend >= 0
              ? parsedSpend
              : (Object.keys(migratedElements) as ElementId[]).reduce(
                  (sum, element) => {
                    let subtotal = 0;
                    for (let level = 0; level < migratedElements[element]; level += 1)
                      subtotal += elementUpgradeCost(level);
                    return sum + subtotal;
                  },
                  0,
                ),
          );
        }
        if (
          parsedSolutions &&
          typeof parsedSolutions === 'object' &&
          !Array.isArray(parsedSolutions)
        ) {
          setSolutions(
            Object.fromEntries(
              Object.entries(parsedSolutions)
                .filter(
                  ([id, value]) =>
                    typeof value === 'string' &&
                    challenges.some((item) => item.id === id),
                )
                .map(([id, value]) => {
                  const challenge = challenges.find((item) => item.id === id)!;
                  return [
                    id,
                    formatCodeForEditor(value as string, challenge.language),
                  ];
                }),
            ),
          );
        }
      } catch {
        /* Ignore malformed saved data without overwriting it. */
      }
      storageLoaded.current = true;
      browserStorage.setItem(storageKeys.schemaVersion, '2');
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (storageLoaded.current)
      browserStorage.setItem(storageKeys.locale, locale);
  }, [locale]);
  useEffect(() => {
    if (storageLoaded.current)
      browserStorage.setItem(storageKeys.mascotGender, mascotGender);
  }, [mascotGender]);
  useEffect(() => {
    if (storageLoaded.current)
      browserStorage.setItem(storageKeys.mascotProfession, mascotProfession);
  }, [mascotProfession]);
  useEffect(() => {
    if (storageLoaded.current)
      browserStorage.setItem(
        storageKeys.ownedEquipment,
        JSON.stringify(ownedEquipment),
      );
  }, [ownedEquipment]);
  useEffect(() => {
    if (storageLoaded.current)
      browserStorage.setItem(
        storageKeys.equippedEquipment,
        equippedEquipment ?? '',
      );
  }, [equippedEquipment]);
  useEffect(() => {
    if (storageLoaded.current)
      browserStorage.setItem(storageKeys.equipmentSpend, String(equipmentSpend));
  }, [equipmentSpend]);
  useEffect(() => {
    if (storageLoaded.current)
      browserStorage.setItem(storageKeys.elementLevels, JSON.stringify(elementLevels));
  }, [elementLevels]);
  useEffect(() => {
    if (storageLoaded.current)
      browserStorage.setItem(storageKeys.elementSpend, String(elementSpend));
  }, [elementSpend]);
  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-Hant-TW' : 'en';
  }, [locale]);

  useEffect(() => {
    if (engineReady) return;
    const timer = window.setInterval(() => {
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'SOC_RTL_ENGINE_PING' },
        window.location.origin,
      );
    }, 750);
    return () => window.clearInterval(timer);
  }, [engineReady]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== iframeRef.current?.contentWindow
      )
        return;
      if (event.data?.type === 'SOC_RTL_ENGINE_READY') {
        setEngineReady(true);
        return;
      }
      if (
        event.data?.type !== 'SOC_RTL_RESULT' ||
        event.data.requestId !== pendingRequest.current
      )
        return;
      pendingRequest.current = null;
      const next: Result = {
        ok: Boolean(event.data.ok),
        phase: event.data.phase,
        console: String(event.data.console || ''),
        elapsedMs: Number(event.data.elapsedMs || 0),
      };
      setResult(next);
      setWaveformVcd(String(event.data.vcd || ''));
      setRunning(false);
      scheduleMascotReturn();
      if (next.ok) markSolved(current.id);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [current.id, markSolved, scheduleMascotReturn]);

  useEffect(() => {
    const onSynthesis = (event: MessageEvent) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== iframeRef.current?.contentWindow ||
        event.data?.type !== 'SOC_RTL_SYNTH_RESULT' ||
        event.data.requestId !== pendingSynth.current
      )
        return;
      pendingSynth.current = null;
      setEstimating(false);
      if (!event.data.ok) {
        setAreaError(String(event.data.console || text.areaError));
        setAreaResult(null);
        return;
      }
      setAreaError('');
      setAreaResult({
        total: Number(event.data.total || 0),
        counts: event.data.counts || {},
        referenceTotal:
          event.data.referenceTotal === null ||
          event.data.referenceTotal === undefined
            ? null
            : Number(event.data.referenceTotal),
        elapsedMs: Number(event.data.elapsedMs || 0),
      });
    };
    window.addEventListener('message', onSynthesis);
    return () => window.removeEventListener('message', onSynthesis);
  }, [text.areaError]);

  useEffect(() => {
    const nav = navigator as Navigator & {
      modelContext?: {
        registerTool: (definition: unknown) => void;
        unregisterTool?: (name: string) => void;
      };
    };
    if (!nav.modelContext?.registerTool) return;
    nav.modelContext.registerTool({
      name: 'open_soc_rtl_challenge',
      description: 'Open one SoC RTL Lab challenge by its id.',
      inputSchema: {
        type: 'object',
        properties: { challengeId: { type: 'string' } },
        required: ['challengeId'],
      },
      execute: async ({ challengeId }: { challengeId: string }) => ({
        content: [
          {
            type: 'text',
            text: selectChallenge(challengeId)
              ? `Opened ${challengeId}`
              : `Unknown challenge: ${challengeId}`,
          },
        ],
      }),
    });
    return () => nav.modelContext?.unregisterTool?.('open_soc_rtl_challenge');
  }, [selectChallenge]);

  const updateCode = (next: string) => {
    pendingRequest.current = null;
    pendingSynth.current = null;
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'SOC_RTL_CANCEL' },
      window.location.origin,
    );
    setRunning(false);
    setBattleVisible(false);
    if (battleReturnTimer.current !== null) {
      window.clearTimeout(battleReturnTimer.current);
      battleReturnTimer.current = null;
    }
    if (instantJudgeTimer.current !== null) {
      window.clearTimeout(instantJudgeTimer.current);
      instantJudgeTimer.current = null;
    }
    setEstimating(false);
    setAreaResult(null);
    setAreaError('');
    setSolutions((previous) => {
      const updated = { ...previous, [current.id]: next };
      browserStorage.setItem(storageKeys.code, JSON.stringify(updated));
      return updated;
    });
    setResult(null);
    setWaveformVcd('');
  };

  const gradePatterns = () => {
    const failures = patternFailures(code, current.patternRules ?? []);
    const ok = failures.length === 0;
    setResult({
      ok,
      phase: 'pattern',
      console: ok
        ? locale === 'zh'
          ? '結構檢查通過；尚未編譯或執行 UVM 模擬，不能代表功能正確。\n@@PASS@@'
          : 'Structural checks passed; UVM was not compiled or simulated. Functional correctness is not established.\n@@PASS@@'
        : failures
            .map(
              (rule, index) =>
                `${index + 1}. ${localize(rule.message, locale)}`,
            )
            .join('\n'),
      elapsedMs: 0,
    });
    if (ok) markSolved(current.id);
  };

  const run = () => {
    setMascotInteraction('');
    setResult(null);
    setWaveformVcd('');
    startBattle();
    if (current.judge === 'pattern') {
      setRunning(true);
      instantJudgeTimer.current = window.setTimeout(() => {
        gradePatterns();
        setRunning(false);
        scheduleMascotReturn();
        instantJudgeTimer.current = null;
      }, 650);
      return;
    }
    if (current.judge === 'cnf') {
      setRunning(true);
      instantJudgeTimer.current = window.setTimeout(() => {
        const graded = gradeXorCnf(code, locale);
        setResult({
          ok: graded.ok,
          phase: 'cnf',
          console: graded.message,
          elapsedMs: 0,
        });
        setRunning(false);
        scheduleMascotReturn();
        instantJudgeTimer.current = null;
        if (graded.ok) markSolved(current.id);
      }, 650);
      return;
    }
    if (!engineReady || !iframeRef.current?.contentWindow) {
      setResult({ ok: false, phase: 'engine', console: text.engineLoading });
      scheduleMascotReturn();
      return;
    }
    const requestId = `${Date.now()}-${Math.random()}`;
    pendingRequest.current = requestId;
    setRunning(true);
    iframeRef.current.contentWindow.postMessage(
      {
        type: 'SOC_RTL_RUN',
        requestId,
        design: code,
        testbench: current.testbench,
        generation: current.language === 'Verilog-2005' ? '2005' : '2012',
      },
      window.location.origin,
    );
  };

  const runHoldAction = (
    action: 'delay' | 'pipeline' | 'false-path' | 'speed-up',
  ) => {
    setMascotInteraction('');
    const messages =
      locale === 'zh'
        ? {
            delay:
              '正確：在資料路徑插入少量 delay cell／buffer 後，hold slack 轉正；因為資料變慢，setup margin 同時減少，所以必須一起重跑 max/min timing。',
            pipeline:
              '不建議：新增 RTL pipeline FF 會改變週期延遲與介面協定，除非架構規格允許，否則不是一般 hold 修法。',
            'false-path':
              '錯誤：false path 只適用真正不需計時的路徑；把真實同步路徑切掉只是隱藏 violation。',
            'speed-up':
              '方向相反：加快 data path 會讓資料更早抵達，hold slack 會更差。',
          }
        : {
            delay:
              'Correct: a small data-path delay cell/buffer makes hold slack positive. Because data is now slower, setup margin shrinks, so both max and min timing must be rechecked.',
            pipeline:
              'Not recommended: an RTL pipeline register changes cycle latency and the interface contract. It is not a normal hold repair unless the architecture allows it.',
            'false-path':
              'Incorrect: false paths are only for paths that truly do not require timing. Cutting a real synchronous path only hides the violation.',
            'speed-up':
              'Wrong direction: speeding up the data path makes data arrive even earlier and worsens hold slack.',
          };
    if (action === 'delay') {
      setHoldLab({
        setup: 0.04,
        hold: 0.02,
        message: messages.delay,
        ok: true,
      });
      setResult({ ok: true, phase: 'interactive', console: messages.delay });
      markSolved(current.id);
    } else if (action === 'speed-up') {
      setHoldLab({
        setup: 0.17,
        hold: -0.13,
        message: messages[action],
        ok: false,
      });
      setResult({ ok: false, phase: 'interactive', console: messages[action] });
    } else {
      setHoldLab({ ...initialHoldLab, message: messages[action], ok: false });
      setResult({ ok: false, phase: 'interactive', console: messages[action] });
    }
  };

  const estimateArea = () => {
    if (!engineReady || !iframeRef.current?.contentWindow) return;
    const requestId = `synth-${Date.now()}`;
    pendingSynth.current = requestId;
    setEstimating(true);
    setAreaError('');
    setAreaResult(null);
    iframeRef.current.contentWindow.postMessage(
      {
        type: 'SOC_RTL_SYNTH',
        requestId,
        design: code,
        reference: current.referenceSolution,
        generation: current.language === 'Verilog-2005' ? '2005' : '2012',
      },
      window.location.origin,
    );
  };

  const filtered = useMemo(
    () =>
      challenges.filter((item) => {
        const matchesTrack = track === 'all' || item.track === track;
        return (
          matchesTrack &&
          `${item.title.zh} ${item.title.en} ${item.id}`
            .toLowerCase()
            .includes(query.toLowerCase())
        );
      }),
    [track, query],
  );
  const points = solved.reduce(
    (sum, id) => sum + (challenges.find((item) => item.id === id)?.points ?? 0),
    0,
  );
  const professionProgress = Object.fromEntries(
    (Object.keys(professionUnlocks) as UnlockableProfession[]).map(
      (profession) => {
        const rule = professionUnlocks[profession];
        const count = solved.filter((id) => {
          const challenge = challenges.find((item) => item.id === id);
          return challenge ? rule.tracks.includes(challenge.track) : false;
        }).length;
        return [profession, { count, unlocked: count >= rule.required }];
      },
    ),
  ) as Record<UnlockableProfession, { count: number; unlocked: boolean }>;
  const spentPoints = equipmentSpend + elementSpend;
  const walletPoints = Math.max(0, points - spentPoints);
  const progress = Math.round((solved.length / challenges.length) * 100);
  const mascotStage = mascotStageFor(points);
  const activeMascotProfession =
    mascotProfession !== 'novice' &&
    !professionProgress[mascotProfession].unlocked
      ? 'novice'
      : mascotProfession;
  const activeEquipment =
    equippedEquipment &&
    ownedEquipment.includes(equippedEquipment) &&
    (equipmentCatalog[equippedEquipment].profession === 'all' ||
      equipmentCatalog[equippedEquipment].profession === activeMascotProfession)
      ? equippedEquipment
      : null;
  const battleStatus: BattleStatus = running
    ? 'running'
    : result
      ? result.ok
        ? 'success'
        : 'failure'
      : 'idle';
  const mascot = mascotProfessions[activeMascotProfession];
  const mascotTitle =
    activeMascotProfession === 'novice'
      ? mascot.title[locale]
      : `${mascotTiers[locale][mascotStage]}${locale === 'zh' ? '' : ' '}${mascot.title[locale]}`;
  const currentIndex = challenges.findIndex((item) => item.id === current.id);
  const nextChallenge = challenges[(currentIndex + 1) % challenges.length];
  const editorFileName =
    current.language === 'CNF / DIMACS'
      ? 'formula.cnf'
      : current.language === 'SystemVerilog/UVM'
        ? 'scoreboard.sv'
        : 'solution.v';
  const hintLayers = [
    current.hints[0] ?? {
      zh: '先確認 reset、latency 與邊界條件。',
      en: 'Start with reset, latency, and boundary conditions.',
    },
    current.hints[1] ??
      current.specs[0] ?? {
        zh: '保持 module 介面不變。',
        en: 'Keep the module interface unchanged.',
      },
    current.hints[2] ?? {
      zh: '把問題拆成 register、組合邏輯與控制訊號三部分，再逐拍檢查預期值。',
      en: 'Separate registers, combinational logic, and control, then check the expected value cycle by cycle.',
    },
  ];

  const buyEquipment = (id: EquipmentId) => {
    if (ownedEquipment.includes(id) || walletPoints < equipmentCatalog[id].cost)
      return;
    setOwnedEquipment((previous) => [...previous, id]);
    setEquipmentSpend((previous) => previous + equipmentCatalog[id].cost);
    const profession = equipmentCatalog[id].profession;
    if (profession === 'all' || profession === activeMascotProfession) {
      setEquippedEquipment(id);
    }
  };

  const buyElementStone = (element: ElementId) => {
    const cost = elementUpgradeCost(elementLevels[element]);
    if (walletPoints < cost) return;
    setElementSpend((previous) => previous + cost);
    setElementLevels((previous) => ({
      ...previous,
      [element]: previous[element] + 1,
    }));
  };

  const interactWithMascot = () => {
    const lines =
      locale === 'zh'
        ? [
            '先看第一個失敗 cycle，不要從最後一拍猜。',
            '把 expected 與 actual 對齊同一筆 transaction。',
            '先確認 reset、valid／ready 與 latency。',
            '波形是證據；最後要能說出 root cause。',
          ]
        : [
            'Start at the first failing cycle, not the final symptom.',
            'Align expected and actual to the same transaction.',
            'Check reset, valid/ready, and latency first.',
            'Waveforms are evidence; finish with the root cause.',
          ];
    setMascotTapNonce((value) => value + 1);
    setMascotInteraction(lines[mascotTapNonce % lines.length]);
  };

  const selectProfession = (profession: MascotProfession) => {
    if (profession === 'novice' || professionProgress[profession].unlocked)
      setMascotProfession(profession);
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <iframe
        ref={iframeRef}
        src="./engine/runner.html"
        title="Icarus Verilog simulation engine"
        className="hidden"
        sandbox="allow-scripts allow-same-origin"
      />
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1580px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <button
            type="button"
            className="flex items-center gap-3 text-left"
            onClick={() => selectChallenge(challenges[0].id)}
          >
            <div className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Cpu className="size-5" />
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <h1 className="font-mono text-base font-semibold tracking-tight">
                  SoC RTL Lab
                </h1>
                <span className="text-xs text-muted-foreground">
                  by Xi-Zhu Wang
                </span>
              </div>
              <p className="hidden text-xs text-muted-foreground sm:block">
                {text.subtitle}
              </p>
            </div>
          </button>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="hidden sm:inline-flex"
              nativeButton={false}
              render={
                <a
                  href="https://github.com/xizhuwang/rtl-interview-lab"
                  target="_blank"
                  rel="noreferrer"
                  aria-label={text.source}
                />
              }
            >
              {text.source}
              <ExternalLink />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')}
            >
              <Languages />
              {locale === 'zh' ? 'English' : '繁體中文'}
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1580px] xl:grid-cols-[290px_minmax(0,1fr)_330px]">
        <aside className="border-b border-border bg-sidebar px-4 py-5 xl:min-h-[calc(100vh-65px)] xl:border-b-0 xl:border-r">
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={text.search}
              className="pl-9"
            />
          </div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {text.tracks}
            </p>
            <Badge variant="outline">{challenges.length}</Badge>
          </div>
          <nav
            className="grid grid-cols-2 gap-1 sm:grid-cols-3 xl:grid-cols-1"
            aria-label={text.tracks}
          >
            <button
              type="button"
              onClick={() => setTrack('all')}
              className={`flex min-h-10 items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${track === 'all' ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'hover:bg-sidebar-accent'}`}
            >
              <span>{text.all}</span>
              <span className="font-mono text-xs opacity-70">
                {challenges.length}
              </span>
            </button>
            {tracks.map((item) => {
              const count = challenges.filter(
                (challenge) => challenge.track === item.id,
              ).length;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setTrack(item.id);
                    const first = challenges.find(
                      (challenge) => challenge.track === item.id,
                    );
                    if (first) selectChallenge(first.id);
                  }}
                  className={`flex min-h-10 items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${track === item.id ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'hover:bg-sidebar-accent'}`}
                >
                  <span className="flex items-center gap-2">
                    <span className={`size-2 rounded-full ${item.accent}`} />
                    {localize(item.label, locale)}
                  </span>
                  <span className="font-mono text-xs opacity-70">{count}</span>
                </button>
              );
            })}
          </nav>
          <div className="mt-5 max-h-40 space-y-1 overflow-y-auto border-t border-sidebar-border pt-4 sm:max-h-56 xl:max-h-[calc(100vh-420px)]">
            {filtered.length ? (
              filtered.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectChallenge(item.id)}
                  className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-sm ${current.id === item.id ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'hover:bg-sidebar-accent/60'}`}
                >
                  {solved.includes(item.id) ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                  ) : (
                    <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate">
                      {localize(item.title, locale)}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {item.id}
                    </span>
                  </span>
                </button>
              ))
            ) : (
              <p className="px-2 text-xs leading-5 text-muted-foreground">
                {text.noMatch}
              </p>
            )}
          </div>
          <div className="mt-5 border-t border-sidebar-border pt-4">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{text.progress}</span>
              <span className="font-mono">
                {solved.length} / {challenges.length}
              </span>
            </div>
            <Progress value={progress} className="h-1.5" />
            <div className="mt-3 overflow-hidden rounded-xl border border-sidebar-border bg-sidebar-accent">
              <div className="grid grid-cols-[70px_minmax(0,1fr)] items-center gap-3 p-2.5">
                <MascotAvatar
                  gender={mascotGender}
                  profession={activeMascotProfession}
                  tier={mascotStage}
                  equipment={activeEquipment}
                  elements={elementLevels}
                  className="h-[93px] w-[70px]"
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="flex items-center gap-1.5 text-xs font-semibold">
                      <Trophy className="size-3.5 text-amber-500" />
                      {mascotTitle}
                    </span>
                    <span className="font-mono text-xs font-semibold">
                      {points} {text.points}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] font-medium text-primary">
                    {mascot.field[locale]}
                  </p>
                  <Dialog>
                    <DialogTrigger
                      render={
                        <button
                          type="button"
                          aria-label={text.mascotCustomize}
                          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        />
                      }
                    >
                      <ShoppingBag className="size-3.5" />
                      {text.mascotCustomize}
                    </DialogTrigger>
                    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
                      <DialogHeader>
                        <DialogTitle>{text.mascotCustomize}</DialogTitle>
                        <DialogDescription>
                          {text.mascotDescription}
                        </DialogDescription>
                      </DialogHeader>
                      <div>
                        <p className="mb-2 text-sm font-semibold">
                          {text.mascotGender}
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {(['masculine', 'feminine'] as MascotGender[]).map(
                            (gender) => (
                              <button
                                key={gender}
                                type="button"
                                aria-pressed={mascotGender === gender}
                                onClick={() => setMascotGender(gender)}
                                className={`rounded-lg border px-3 py-2 text-sm transition-colors ${mascotGender === gender ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted'}`}
                              >
                                {gender === 'masculine'
                                  ? text.masculine
                                  : text.feminine}
                              </button>
                            ),
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="mb-2 text-sm font-semibold">
                          {text.mascotProfession}
                        </p>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {(
                            Object.keys(
                              professionUnlocks,
                            ) as UnlockableProfession[]
                          ).map((profession) => {
                            const item = mascotProfessions[profession];
                            const rule = professionUnlocks[profession];
                            const status = professionProgress[profession];
                            return (
                              <button
                                key={profession}
                                type="button"
                                disabled={!status.unlocked}
                                aria-pressed={
                                  activeMascotProfession === profession
                                }
                                onClick={() => selectProfession(profession)}
                                className={`relative rounded-xl border p-2 text-center transition-colors ${activeMascotProfession === profession ? 'border-primary bg-primary/10' : status.unlocked ? 'border-border hover:bg-muted' : 'cursor-not-allowed border-border bg-muted/40 opacity-65'}`}
                              >
                                {!status.unlocked && (
                                  <span className="absolute right-2 top-2 z-20 grid size-6 place-items-center rounded-full bg-card shadow">
                                    <LockKeyhole className="size-3.5" />
                                  </span>
                                )}
                                <MascotAvatar
                                  gender={mascotGender}
                                  profession={profession}
                                  tier={mascotStage}
                                  className="mx-auto h-24 w-[72px]"
                                />
                                <span className="mt-1 block text-xs font-semibold">
                                  {item.title[locale]}
                                </span>
                                <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">
                                  {status.count}/{rule.required}{' '}
                                  {text.solvedNeeded}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                        {activeMascotProfession !== 'novice' && (
                          <button
                            type="button"
                            onClick={() => selectProfession('novice')}
                            className="mt-2 text-xs text-muted-foreground hover:text-foreground"
                          >
                            {locale === 'zh'
                              ? '切回邏輯學徒'
                              : 'Return to Logic Apprentice'}
                          </button>
                        )}
                      </div>
                      <div className="border-t border-border pt-4">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-sm font-semibold">
                            {text.equipment}
                          </p>
                          <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 font-mono text-xs font-semibold text-amber-800">
                            <Coins className="size-3.5" />
                            {walletPoints} {text.points}
                          </span>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-3">
                          {(Object.keys(equipmentCatalog) as EquipmentId[]).map(
                            (id) => {
                              const item = equipmentCatalog[id];
                              const owned = ownedEquipment.includes(id);
                              const equipped = activeEquipment === id;
                              const classUnavailable =
                                item.profession !== 'all' &&
                                item.profession !== activeMascotProfession;
                              return (
                                <div
                                  key={id}
                                  className={`rounded-xl border p-3 ${equipped ? 'border-primary bg-primary/5' : 'border-border'}`}
                                >
                                  <div className={`equipment-shop-icon equipment-${item.profession}`}>
                                    {item.artwork ? (
                                      <EquipmentArtwork src={item.artwork.src} />
                                    ) : (
                                      <EquipmentIcon id={item.icon} className="equipment-shop-main-icon" />
                                    )}
                                  </div>
                                  <p className="mt-2 text-center text-sm font-semibold">
                                    {item.name[locale]}
                                  </p>
                                  {item.profession !== 'all' && (
                                    <p className="mt-1 text-center text-[10px] font-semibold uppercase tracking-wide text-primary">
                                      {mascotProfessions[item.profession].field[locale]}
                                    </p>
                                  )}
                                  <p className="mt-1 min-h-10 text-center text-xs leading-5 text-muted-foreground">
                                    {item.effect[locale]}
                                  </p>
                                  {owned ? (
                                    <Button
                                      variant={
                                        equipped ? 'secondary' : 'outline'
                                      }
                                      size="sm"
                                      className="mt-2 w-full"
                                      disabled={classUnavailable}
                                      onClick={() =>
                                        setEquippedEquipment(
                                          equipped ? null : id,
                                        )
                                      }
                                    >
                                      {classUnavailable
                                        ? text.professionRequired
                                        : equipped
                                          ? text.unequip
                                          : text.equip}
                                    </Button>
                                  ) : (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="mt-2 w-full"
                                      disabled={walletPoints < item.cost}
                                      onClick={() => buyEquipment(id)}
                                    >
                                      <Coins /> {text.buy} · {item.cost}
                                    </Button>
                                  )}
                                </div>
                              );
                            },
                          )}
                        </div>
                      </div>
                      <div className="border-t border-border pt-4">
                        <div className="mb-3">
                          <p className="text-sm font-semibold">{text.enchantments}</p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            {text.enchantmentBody}
                          </p>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                          {(Object.keys(elementCatalog) as ElementId[]).map((element) => {
                            const item = elementCatalog[element];
                            const level = elementLevels[element];
                            const cost = elementUpgradeCost(level);
                            const Icon = element === 'fire' ? Flame : element === 'water' ? Waves : element === 'wind' ? Wind : Shield;
                            return (
                              <div key={element} className={`element-stone-card ${item.className}`}>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="element-stone-icon"><Icon className="size-6" /></span>
                                  <span className="font-mono text-xs font-semibold">
                                    {text.level} {level}
                                  </span>
                                </div>
                                <p className="mt-3 text-sm font-semibold">{item.name[locale]}</p>
                                <p className="mt-1 min-h-16 text-xs leading-5 text-muted-foreground">{item.effect[locale]}</p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="mt-2 w-full"
                                  disabled={walletPoints < cost}
                                  onClick={() => buyElementStone(element)}
                                >
                                  <Gem /> {text.enhance} · {cost}
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                        {Object.values(elementLevels).every((level) => level > 0) && (
                          <p className="mt-3 flex items-center justify-center gap-2 rounded-lg border border-fuchsia-300/50 bg-fuchsia-500/10 px-3 py-2 text-sm font-semibold text-fuchsia-700 dark:text-fuchsia-200">
                            <Sparkles className="size-4" /> {text.fourRoots}
                          </p>
                        )}
                      </div>
                      <div className="rounded-xl border border-dashed border-border bg-muted/35 p-4">
                        <div className="flex items-start gap-3">
                          <Gift className="mt-0.5 size-5 shrink-0 text-primary" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold">{text.support}</p>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">{text.supportBody}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                nativeButton={false}
                                render={<a href={supportConfig.paypalUrl} target="_blank" rel="noreferrer" aria-label={text.paypalAction} />}
                              >
                                <ExternalLink /> {text.paypalAction}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                nativeButton={false}
                                render={<a href="https://xizhuwang.github.io/" target="_blank" rel="noreferrer" aria-label={text.contactSupport} />}
                              >
                                <ExternalLink /> {text.contactSupport}
                              </Button>
                              <Button size="sm" variant="outline" disabled>
                                <Coins /> {text.paidPointsPending}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                      <DialogClose render={<Button className="w-full" />}>
                        {text.mascotDone}
                      </DialogClose>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <section className="min-w-0 px-4 py-6 sm:px-7">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary">
                  {String(current.order).padStart(2, '0')}
                </Badge>
                <Badge variant="outline">
                  {localize(kindLabel[current.kind], locale)}
                </Badge>
                <Badge variant="outline">
                  {localize(difficultyLabel[current.difficulty], locale)}
                </Badge>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock3 className="size-3.5" />
                  {current.minutes} min
                </span>
                <span className="font-mono text-xs text-primary">
                  +{current.points} {text.points}
                </span>
              </div>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {localize(current.title, locale)}
              </h2>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {current.id}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => selectChallenge(nextChallenge.id)}
            >
              {text.next}
              <ChevronRight />
            </Button>
          </div>
          <article className="mb-5 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
              <BookOpen className="size-4 text-primary" />
              {text.task}
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              {localize(current.description, locale)}
            </p>
            <div className="mt-4 border-t border-border pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                {text.constraints}
              </p>
              <ul className="space-y-2 text-sm leading-6 text-muted-foreground">
                {current.specs.map((spec, index) => (
                  <li key={index} className="flex gap-2">
                    <ArrowRight className="mt-1.5 size-3.5 shrink-0 text-primary" />
                    {localize(spec, locale)}
                  </li>
                ))}
              </ul>
            </div>
            {goldenPattern && (
              <section className="golden-pattern mt-4 border-t border-border pt-4" aria-labelledby="golden-pattern-title">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p id="golden-pattern-title" className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Waves className="size-4 text-cyan-500" />
                      {text.goldenPattern}
                    </p>
                    <p className="mt-1 text-sm font-medium text-cyan-800 dark:text-cyan-200">
                      {localize(goldenPattern.title, locale)}
                    </p>
                  </div>
                  <Badge variant="outline" className="border-cyan-300 text-cyan-700 dark:border-cyan-800 dark:text-cyan-200">
                    {locale === 'zh' ? '行為範例' : 'Behavior example'}
                  </Badge>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {localize(goldenPattern.summary, locale)}
                </p>
                <div className="golden-pattern-table mt-3 overflow-x-auto rounded-lg border border-cyan-200/80 dark:border-cyan-900">
                  <table>
                    <thead>
                      <tr>
                        {goldenPattern.columns.map((column, index) => (
                          <th key={index} scope="col">{localize(column, locale)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {goldenPattern.rows.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          {row.map((cell, cellIndex) => (
                            <td key={cellIndex} className={cellIndex === 0 ? 'golden-event-cell' : undefined}>
                              {typeof cell === 'string' ? cell : localize(cell, locale)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {goldenPattern.notes && goldenPattern.notes.length > 0 && (
                  <ul className="mt-3 space-y-1.5 text-xs leading-5 text-muted-foreground">
                    {goldenPattern.notes.map((note, index) => (
                      <li key={index} className="flex gap-2">
                        <ArrowRight className="mt-1 size-3 shrink-0 text-cyan-500" />
                        {localize(note, locale)}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-3 border-t border-cyan-200/70 pt-2 text-xs leading-5 text-muted-foreground dark:border-cyan-900">
                  {text.goldenPatternNote}
                </p>
              </section>
            )}
            <div className="mascot-companion-stage mt-4 grid grid-cols-[84px_minmax(0,1fr)] items-end gap-3 border-t border-border pt-4 sm:grid-cols-[104px_minmax(0,1fr)]">
              <button
                key={`hint-${mascotTapNonce}`}
                type="button"
                onClick={interactWithMascot}
                aria-label={text.mascotInteract}
                className={`mascot-hint-button mascot-tapped ${battleVisible ? 'mascot-departed' : ''}`}
              >
                <MascotAvatar
                  gender={mascotGender}
                  profession={activeMascotProfession}
                  tier={mascotStage}
                  equipment={activeEquipment}
                  elements={elementLevels}
                  className="h-28 w-[84px] sm:h-[139px] sm:w-[104px]"
                />
              </button>
              <div className="min-w-0">
                <div className="relative rounded-xl rounded-bl-sm border border-primary/20 bg-primary/5 px-3 py-2.5 text-xs leading-5 text-muted-foreground before:absolute before:-left-2 before:bottom-3 before:size-4 before:rotate-45 before:border-b before:border-l before:border-primary/20 before:bg-card">
                  <span className="relative">
                    <strong className="font-semibold text-foreground">
                      {mascotInteraction || mascot.message[locale]}
                    </strong>{' '}
                    {text.hintBuddy}
                  </span>
                  {context && (
                    <span className="mascot-learning-context">
                      <span><b>{text.whyTitle}</b> {localize(context.why, locale)}</span>
                      <span><b>{text.rolesTitle}</b> {localize(context.roles, locale)}</span>
                    </span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setRevealedHints((value) => Math.min(3, value + 1))
                    }
                    disabled={revealedHints >= 3}
                    className="flex items-center gap-2 text-sm font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Lightbulb className="size-4" />
                    {text.hint} · {3 - revealedHints} {text.hintsLeft}
                    <ChevronDown
                      className={`size-4 transition-transform ${revealedHints > 0 ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {current.judge !== 'interactive' && (
                    <Button
                      size="sm"
                      onClick={run}
                      disabled={running || (current.judge === 'simulation' && !engineReady)}
                      className="mascot-run-button ml-auto"
                    >
                      {running ? <LoaderCircle className="animate-spin" /> : <Swords />}
                      {running ? text.running : text.run}
                    </Button>
                  )}
                  {current.difficulty === 'advanced' && (
                    <Badge className="border-red-300 bg-red-500/10 text-red-700 dark:border-red-900 dark:text-red-200" variant="outline">
                      BOSS
                    </Badge>
                  )}
                </div>
                {revealedHints > 0 && (
                  <ol className="mt-3 space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                    {hintLayers.slice(0, revealedHints).map((hint, index) => (
                      <li key={index}>
                        <span className="mr-2 font-mono text-xs opacity-70">
                          {index + 1}/3
                        </span>
                        {localize(hint, locale)}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
              {battleVisible && (
                <BattleArena
                  gender={mascotGender}
                  profession={activeMascotProfession}
                  tier={mascotStage}
                  equipment={activeEquipment}
                  elements={elementLevels}
                  status={battleStatus}
                  isBoss={current.difficulty === 'advanced'}
                />
              )}
            </div>
          </article>
          {current.supportCode && (
            <details className="mb-5 rounded-xl border border-border bg-card p-4">
              <summary className="cursor-pointer text-sm font-semibold text-primary">
                {locale === 'zh'
                  ? '題目提供的 SRAM IP 模型（唯讀）'
                  : 'Provided SRAM IP model (read-only)'}
              </summary>
              <ReadOnlyCodeBlock
                code={formatCodeForEditor(current.supportCode, 'Verilog-2005')}
                language="Verilog-2005"
                ariaLabel={
                  locale === 'zh'
                    ? '唯讀 SRAM IP 原始碼'
                    : 'Read-only SRAM IP source'
                }
              />
            </details>
          )}
          {current.judge === 'interactive' ? (
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-lg">
              <div className="border-b border-border bg-muted/40 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Gauge className="size-4 text-primary" />
                  {locale === 'zh'
                    ? '互動式 Timing Lab'
                    : 'Interactive Timing Lab'}
                </div>
              </div>
              <div className="grid gap-5 p-5 lg:grid-cols-[1fr_1.2fr]">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {locale === 'zh' ? '目前報告' : 'Current report'}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-border p-4">
                      <p className="text-xs text-muted-foreground">
                        Setup slack (max)
                      </p>
                      <p
                        className={`mt-1 whitespace-nowrap font-mono text-xl font-semibold ${holdLab.setup < 0 ? 'text-destructive' : 'text-success'}`}
                      >
                        {holdLab.setup >= 0 ? '+' : ''}
                        {holdLab.setup.toFixed(2)} ns
                      </p>
                    </div>
                    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
                      <p className="text-xs text-muted-foreground">
                        Hold slack (min)
                      </p>
                      <p
                        className={`mt-1 whitespace-nowrap font-mono text-xl font-semibold ${holdLab.hold < 0 ? 'text-destructive' : 'text-success'}`}
                      >
                        {holdLab.hold >= 0 ? '+' : ''}
                        {holdLab.hold.toFixed(2)} ns
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-muted-foreground">
                    {locale === 'zh'
                      ? 'Setup 已通過，但 hold 失敗：資料在 capture edge 後太早抵達。'
                      : 'Setup passes, but hold fails: data arrives too early after the capture edge.'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {locale === 'zh'
                      ? '選擇修復動作'
                      : 'Choose a repair action'}
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <Button
                      variant="outline"
                      className="h-auto justify-start whitespace-normal py-3 text-left"
                      onClick={() => runHoldAction('delay')}
                    >
                      {locale === 'zh'
                        ? '插入 data-path delay cell／buffer'
                        : 'Insert a data-path delay cell/buffer'}
                    </Button>
                    <Button
                      variant="outline"
                      className="h-auto justify-start whitespace-normal py-3 text-left"
                      onClick={() => runHoldAction('speed-up')}
                    >
                      {locale === 'zh'
                        ? '加速 data path'
                        : 'Speed up the data path'}
                    </Button>
                    <Button
                      variant="outline"
                      className="h-auto justify-start whitespace-normal py-3 text-left"
                      onClick={() => runHoldAction('pipeline')}
                    >
                      {locale === 'zh'
                        ? '在 RTL 多塞一級 FF'
                        : 'Add another RTL pipeline FF'}
                    </Button>
                    <Button
                      variant="outline"
                      className="h-auto justify-start whitespace-normal py-3 text-left"
                      onClick={() => runHoldAction('false-path')}
                    >
                      {locale === 'zh'
                        ? '把路徑設成 false path'
                        : 'Declare the path false'}
                    </Button>
                  </div>
                  <button
                    type="button"
                    className="mt-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setHoldLab({ ...initialHoldLab });
                      setResult(null);
                    }}
                  >
                    <RotateCcw className="size-3.5" />
                    {locale === 'zh' ? '重設情境' : 'Reset scenario'}
                  </button>
                </div>
              </div>
              {holdLab.message && (
                <div
                  className={`border-t px-5 py-4 text-sm leading-6 ${holdLab.ok ? 'border-success/30 bg-success/8 text-success' : 'border-destructive/20 bg-destructive/5 text-foreground'}`}
                >
                  {holdLab.message}
                </div>
              )}
              <details className="border-t border-border px-5 py-4">
                <summary className="cursor-pointer text-sm font-semibold text-primary">
                  {text.commandGuide}
                </summary>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {text.commandCaution}
                </p>
                <div className="mt-4 grid gap-3 lg:grid-cols-3">
                  {timingCommandGuide.map((guide) => (
                    <div
                      key={guide.tool}
                      className="rounded-lg border border-border bg-muted/30 p-3"
                    >
                      <p className="text-sm font-semibold">{guide.tool}</p>
                      <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Inspect
                      </p>
                      <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded bg-editor p-2 font-mono text-[10px] leading-5 text-editor-foreground">
                        {guide.inspect}
                      </pre>
                      <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Repair / optimize
                      </p>
                      <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded bg-editor p-2 font-mono text-[10px] leading-5 text-editor-foreground">
                        {guide.repair}
                      </pre>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        {localize(guide.note, locale)}
                      </p>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-editor-border bg-editor shadow-lg">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-editor-border px-3 py-2">
                <div className="flex items-center gap-2 text-xs text-editor-muted">
                  <Code2 className="size-4" />
                  {editorFileName}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-code text-[11px] text-editor-muted">
                    {current.language}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateCode(starterCode)}
                    className="flex items-center gap-1 text-xs text-editor-muted hover:text-editor-foreground"
                  >
                    <RotateCcw className="size-3.5" />
                    {text.reset}
                  </button>
                </div>
              </div>
              <CodeEditor
                value={code}
                onChange={updateCode}
                language={current.language}
                ariaLabel={locale === 'zh' ? '程式碼編輯器' : 'Code editor'}
              />
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-editor-border px-3 py-2.5">
                <span className="flex items-center gap-2 text-xs text-editor-muted">
                  <ShieldCheck className="size-3.5" />
                  {text.codeLocal}
                </span>
                <Button
                  onClick={run}
                  disabled={
                    running || (current.judge === 'simulation' && !engineReady)
                  }
                >
                  {running ? (
                    <LoaderCircle className="animate-spin" />
                  ) : (
                    <Play />
                  )}
                  {running ? text.running : text.run}
                </Button>
              </div>
            </div>
          )}
          {waveformVcd && <WaveformViewer vcd={waveformVcd} locale={locale} />}
          <div className="mt-6 rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex items-start gap-3">
              <Gauge className="mt-0.5 size-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold">{text.ppaTitle}</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {text.ppaBody}
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {text.noInstall}
                </p>
                <div className="mt-3">
                  {current.judge === 'simulation' &&
                    current.id !== 'soc-sram-ip-wrapper' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={estimateArea}
                        disabled={!engineReady || estimating}
                      >
                        {estimating ? (
                          <LoaderCircle className="animate-spin" />
                        ) : (
                          <Gauge />
                        )}
                        {estimating ? text.estimating : text.estimate}
                      </Button>
                    )}
                </div>
                {areaResult && (
                  <div className="mt-3 rounded-lg border border-border bg-card p-3">
                    {areaResult.referenceTotal !== null ? (
                      <div className="grid gap-2 sm:grid-cols-3">
                        <div>
                          <p className="text-[10px] uppercase text-muted-foreground">
                            {text.userResult}
                          </p>
                          <p className="font-mono text-lg font-semibold">
                            {areaResult.total}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase text-muted-foreground">
                            {text.reference}
                          </p>
                          <p className="font-mono text-lg font-semibold">
                            {areaResult.referenceTotal}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase text-muted-foreground">
                            {text.delta}
                          </p>
                          <p
                            className={`font-mono text-lg font-semibold ${areaResult.total <= areaResult.referenceTotal ? 'text-success' : 'text-amber-600'}`}
                          >
                            {areaResult.total - areaResult.referenceTotal > 0
                              ? '+'
                              : ''}
                            {areaResult.total - areaResult.referenceTotal} cells
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="font-mono text-sm font-semibold">
                        {areaResult.total} {text.genericCells}
                      </p>
                    )}
                    <p className="mt-2 break-words border-t border-border pt-2 font-mono text-[11px] leading-5 text-muted-foreground">
                      {Object.entries(areaResult.counts)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 8)
                        .map(([name, count]) => `${name}: ${count}`)
                        .join(' · ')}
                    </p>
                    {areaResult.referenceTotal !== null && (
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        {locale === 'zh'
                          ? '基準與你的 RTL 使用同一次、同版本、同參數的 Yosys generic synthesis；數字只能做相對比較，越少不一定代表實際 PPA 一定更好。'
                          : 'The reference and your RTL use the same Yosys version and generic synthesis settings. This is only a relative comparison; fewer cells do not guarantee better physical PPA.'}
                      </p>
                    )}
                  </div>
                )}
                {areaError && (
                  <p className="mt-3 text-xs text-destructive">
                    {text.areaError}: {areaError}
                  </p>
                )}
                <details className="mt-4 border-t border-border pt-3">
                  <summary className="cursor-pointer text-xs font-medium text-primary">
                    {text.physicalWhy}
                  </summary>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {text.physicalBody}
                  </p>
                </details>
              </div>
            </div>
          </div>
        </section>

        <aside className="border-t border-border bg-card px-4 py-6 sm:px-6 xl:min-h-[calc(100vh-65px)] xl:border-l xl:border-t-0">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <TerminalSquare className="size-4" />
              {locale === 'zh' ? '測試結果' : 'Test results'}
            </div>
            {solved.includes(current.id) && (
              <Badge className="bg-success text-white">
                <Check className="size-3" />
                {locale === 'zh' ? '已完成' : 'Solved'}
              </Badge>
            )}
          </div>
          {!result ? (
            <div className="rounded-xl border border-dashed border-border p-4">
              {current.judge === 'simulation' && !engineReady ? (
                <LoaderCircle className="mb-3 size-5 animate-spin text-primary" />
              ) : (
                <Circle className="mb-3 size-5 text-muted-foreground" />
              )}
              <p className="text-sm font-medium">
                {current.judge === 'simulation'
                  ? engineReady
                    ? text.engineReady
                    : text.engineLoading
                  : current.judge === 'interactive'
                    ? text.interactiveReady
                    : current.judge === 'cnf'
                      ? text.cnfReady
                      : text.patternReady}
              </p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {text.waitingBody}
              </p>
            </div>
          ) : result.ok ? (
            <output className="block rounded-xl border border-success/30 bg-success/8 p-4">
              <div className="mb-2 flex items-center gap-2 font-medium text-success">
                <CheckCircle2 className="size-5" />
                {result.phase === 'pattern'
                  ? locale === 'zh'
                    ? '結構檢查通過'
                    : 'Structure checks passed'
                  : text.passed}
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                {result.phase === 'simulate'
                  ? locale === 'zh'
                    ? '功能測試通過，不代表 CDC 結構、實體時序或 PPA 已 signoff。'
                    : 'Functional tests passed; CDC structure, physical timing and PPA are not signed off.'
                  : result.phase === 'pattern'
                    ? locale === 'zh'
                      ? '未編譯或執行 UVM 模擬；此結果僅代表必要結構已找到。'
                      : 'UVM was not compiled or simulated; only required structures were found.'
                    : text.passedBody}
              </p>
              {result.elapsedMs !== undefined && (
                <p className="mt-2 font-mono text-xs text-muted-foreground">
                  {Math.round(result.elapsedMs)} ms
                </p>
              )}
            </output>
          ) : (
            <output className="block rounded-xl border border-destructive/30 bg-destructive/5 p-4">
              <div className="mb-2 flex items-center gap-2 font-medium text-destructive">
                <XCircle className="size-5" />
                {text.failed}
              </div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {result.phase}
              </p>
            </output>
          )}
          {result?.console && (
            <pre className="mt-3 max-h-[290px] overflow-auto whitespace-pre-wrap rounded-lg bg-editor p-3 font-mono text-[11px] leading-5 text-editor-foreground">
              {result.console
                .replaceAll('@@PASS@@', '')
                .replaceAll('@@FAIL@@', '')
                .trim()}
            </pre>
          )}
          <div className="mt-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {text.testGroups}
            </p>
            <ul className="space-y-3 text-sm">
              {current.testGroups.map((item, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2 text-muted-foreground"
                >
                  <span
                    className={`mt-1.5 size-1.5 shrink-0 rounded-full ${result?.ok ? 'bg-success' : 'bg-border'}`}
                  />
                  {localize(item, locale)}
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-7 border-t border-border pt-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {text.speaking}
            </p>
            <ol className="space-y-3 text-sm">
              {speakingChecklist[current.track].map((item, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2 text-muted-foreground"
                >
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-muted font-mono text-[10px] text-foreground">
                    {index + 1}
                  </span>
                  <span className="leading-5">{localize(item, locale)}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="mt-7 border-t border-border pt-5">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
              <p className="text-xs leading-5 text-muted-foreground">
                {text.staticNote}
              </p>
            </div>
          </div>
        </aside>
      </div>
      <footer className="border-t border-border bg-card px-5 py-6 text-center text-sm leading-6 text-muted-foreground">
        <p>{text.independent}</p>
        <p>
          © 2026 Xi-Zhu Wang ·{' '}
          <a className="underline" href="./LICENSE-GPL-3.0.txt">
            GPL-3.0-or-later
          </a>{' '}
          ·{' '}
          {locale === 'zh'
            ? '前端整合版本，不提供正確性或適用性保證'
            : 'Combined browser distribution; without warranty'}
        </p>
        <details className="mx-auto mt-3 max-w-3xl text-left">
          <summary className="cursor-pointer text-center text-primary">
            {locale === 'zh'
              ? '隱私、開源授權與教學範圍'
              : 'Privacy, open-source licenses and scope'}
          </summary>
          <p className="mt-3">
            {locale === 'zh'
              ? '本站沒有登入、廣告或追蹤分析程式，也沒有接收解題程式碼的後端。程式與進度存於此瀏覽器的 localStorage；同一 GitHub Pages 網域的其他頁面也可能存取這份儲存空間，請勿輸入公司 RTL、NDA 內容、密碼或個資。可透過瀏覽器網站資料設定清除本機紀錄。'
              : 'No accounts, ads, analytics or source-code submission backend. Code and progress use browser localStorage, shared with other pages on this GitHub Pages origin. Do not enter company RTL, NDA material, passwords or personal data. Clear browser site data to remove local records.'}
          </p>
          <p className="mt-2">
            {locale === 'zh'
              ? 'GitHub 提供網站託管，jsDelivr 在執行測試／合成時提供工具檔案；服務商可能收到 IP、瀏覽器資訊與請求紀錄，不等於完全匿名或完全離線。本站不會把編輯器內容加入這些下載請求。Icarus 工具檔案使用固定版本與 SHA-256 檢查；第三方服務與授權仍由其供應者負責。'
              : 'GitHub hosts the site; jsDelivr serves tool downloads on test/synthesis requests. Providers may receive IP addresses, browser information and request logs. This is not anonymous or fully offline. Editor contents are not included in these download requests. Icarus assets are version-pinned and SHA-256 verified; third-party services and licenses remain those of their providers.'}
          </p>
          <p className="mt-2">
            {locale === 'zh'
              ? '題目採用自行撰寫的簡化模型，未附商用 PDK、SRAM IP、標準全文或公司內部資料。結果僅供教學，不等同正式 CDC／STA／APR／Formal signoff；公開測資與本機積分不具防作弊保證。'
              : 'Exercises use independently written simplified models, not commercial PDKs, SRAM IP, full standards or internal company materials. Results are educational, not CDC/STA/APR/formal signoff. Public tests and local scores are not cheat-resistant.'}
          </p>
          <p className="mt-2">
            {locale === 'zh'
              ? 'PayPal.Me 僅供自願支持；本站不會因付款增加遊戲點數，也不會接觸或保存付款帳戶資料。如需其他贊助管道，歡迎透過作者網站聯絡。付款及個資處理由 PayPal 依其條款負責。'
              : 'PayPal.Me is a voluntary-support option only. Payments do not grant game points, and this site does not receive or store payment-account data. Contact the author through the portfolio site if you need another support method. PayPal processes payment and personal data under its own terms.'}{' '}
            <a className="underline" href="https://www.paypal.com/tw/legalhub/privacy-full" target="_blank" rel="noreferrer">
              PayPal privacy
            </a>
          </p>
          <p className="mt-2">
            <a className="underline" href="./THIRD_PARTY_NOTICES.txt">
              {locale === 'zh' ? '第三方來源與授權' : 'Third-party notices'}
            </a>{' '}
            ·{' '}
            <a
              className="underline"
              href="./engine/LICENSE-VERISIM-GPL-2.0.txt"
            >
              GPL
            </a>{' '}
            ·{' '}
            <a
              className="underline"
              href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement"
              target="_blank"
              rel="noreferrer"
            >
              GitHub privacy
            </a>{' '}
            ·{' '}
            <a
              className="underline"
              href="https://www.jsdelivr.com/terms/privacy-policy"
              target="_blank"
              rel="noreferrer"
            >
              jsDelivr privacy
            </a>
          </p>
        </details>
      </footer>
    </main>
  );
}
