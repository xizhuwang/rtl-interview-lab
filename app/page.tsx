'use client';
/* eslint-disable next/no-html-link-for-pages, next/no-img-element -- Static mascot assets are optimized for this client-only build. */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
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
  Hammer,
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
  Star,
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
import { SocInterfaceGuide } from '@/components/soc-interface-guide';
import { AdSenseUnit } from '@/components/adsense-unit';
import {
  challenges,
  difficultyLabel,
  kindLabel,
  localize,
  tracks,
  type Challenge,
  type Locale,
  type TrackId,
} from '@/lib/challenges';
import { formatCodeForEditor } from '@/lib/code-format';
import { gradeXorCnf } from '@/lib/cnf';
import { patternFailures } from '@/lib/pattern-check';
import { learningContext, timingCommandGuide } from '@/lib/learning-context';
import { goldenPatterns } from '@/lib/golden-patterns';
import { speakingChecklist } from '@/lib/readiness';
import { socLearningAids } from '@/lib/soc-learning-aids';
import { solutions as referenceSolutions } from '@/scripts/test-solutions.mjs';

type Result = {
  ok: boolean;
  phase: 'compile' | 'simulate' | 'pattern' | 'engine' | 'interactive' | 'cnf';
  console: string;
  elapsedMs?: number;
  checks?: SimulationCheck[];
  goldenMismatch?: {
    signal: string;
    time: number;
    expected: string;
    actual: string;
  } | null;
};
type SimulationCheck = {
  step: string;
  signal: string;
  cycle: number;
  expected: string;
  actual: string;
  pass: boolean;
};
type EnemyKind =
  | 'training-dummy'
  | 'chip-cat'
  | 'laser-bear'
  | 'timing-boss'
  | 'cosmic-emperor';

const diagnosticStepLabels: Record<string, { zh: string; en: string }> = {
  reset: { zh: 'Reset 後', en: 'After reset' },
  write_control: { zh: '寫入 control', en: 'Write control' },
  read_control: { zh: '讀回 control', en: 'Read control' },
  read_status: { zh: '讀取 status', en: 'Read status' },
  read_unmapped: { zh: '讀取非法位址', en: 'Read unmapped address' },
  always_ready: { zh: 'PREADY 檢查', en: 'PREADY check' },
  protect_status: { zh: '唯讀位址保護', en: 'Read-only address protection' },
  setup_no_write: { zh: 'Setup 不可提前寫入', en: 'No early write in setup' },
};

function SimulationCheckTable({
  checks,
  locale,
}: {
  checks: SimulationCheck[];
  locale: Locale;
}) {
  if (!checks.length) return null;
  const firstFailure = checks.find((check) => !check.pass);
  return (
    <section className="mt-3 overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border px-3 py-2.5">
        <p className="text-sm font-semibold text-foreground">
          {locale === 'zh'
            ? 'Current vs Golden 逐項比較'
            : 'Current vs Golden checks'}
        </p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {firstFailure
            ? locale === 'zh'
              ? `第一個錯誤在 cycle ${firstFailure.cycle} 的 ${firstFailure.signal}。`
              : `The first mismatch is ${firstFailure.signal} at cycle ${firstFailure.cycle}.`
            : locale === 'zh'
              ? '所有列出的訊號值都符合 Golden。'
              : 'All listed signal values match the Golden values.'}
        </p>
      </div>
      <div className="divide-y divide-border font-mono text-[11px]">
        {checks.map((check, index) => (
          <div
            key={`${check.step}-${check.signal}-${check.cycle}-${index}`}
            className={`px-3 py-2.5 ${check.pass ? '' : 'bg-destructive/8'}`}
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className="min-w-0 flex-1 font-sans font-medium text-foreground">
                {diagnosticStepLabels[check.step]?.[locale] ??
                  check.step.replaceAll('_', ' ')}
              </span>
              <span className="shrink-0 text-muted-foreground">
                C{check.cycle}
              </span>
              {check.pass ? (
                <Check
                  className="size-4 shrink-0 text-success"
                  aria-label="pass"
                />
              ) : (
                <XCircle
                  className="size-4 shrink-0 text-destructive"
                  aria-label="fail"
                />
              )}
            </div>
            <dl className="mt-2 grid min-w-0 grid-cols-3 gap-2 rounded-lg bg-muted/45 p-2">
              <div className="min-w-0">
                <dt className="font-sans text-[10px] text-muted-foreground">
                  Signal
                </dt>
                <dd
                  className="truncate font-semibold text-cyan-700 dark:text-cyan-200"
                  title={check.signal}
                >
                  {check.signal}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="font-sans text-[10px] text-muted-foreground">
                  Golden
                </dt>
                <dd className="overflow-x-auto whitespace-nowrap pb-0.5">
                  {check.expected}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="font-sans text-[10px] text-muted-foreground">
                  Current
                </dt>
                <dd
                  className={`overflow-x-auto whitespace-nowrap pb-0.5 ${check.pass ? '' : 'font-bold text-destructive'}`}
                >
                  {check.actual}
                </dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}

function CellComparisonTable({
  currentCounts,
  referenceCounts,
  locale,
}: {
  currentCounts: Record<string, number>;
  referenceCounts: Record<string, number>;
  locale: Locale;
}) {
  const rows = Array.from(
    new Set([...Object.keys(currentCounts), ...Object.keys(referenceCounts)]),
  )
    .map((name) => ({
      name,
      current: currentCounts[name] ?? 0,
      reference: referenceCounts[name] ?? 0,
    }))
    .sort(
      (a, b) =>
        b.current + b.reference - (a.current + a.reference) ||
        a.name.localeCompare(b.name),
    );

  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[31rem] border-collapse text-left text-xs">
        <thead className="bg-muted/55 text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">
              {locale === 'zh' ? 'Generic cell 類型' : 'Generic cell type'}
            </th>
            <th className="px-3 py-2 text-right font-medium">
              {locale === 'zh' ? '你的 RTL' : 'Your RTL'}
            </th>
            <th className="px-3 py-2 text-right font-medium">
              {locale === 'zh' ? '參考解' : 'Reference'}
            </th>
            <th className="px-3 py-2 text-right font-medium">
              {locale === 'zh' ? '差異' : 'Delta'}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border font-mono">
          {rows.map((row) => {
            const delta = row.current - row.reference;
            return (
              <tr key={row.name}>
                <th className="whitespace-nowrap px-3 py-2 font-medium text-foreground">
                  {row.name}
                </th>
                <td className="px-3 py-2 text-right">{row.current}</td>
                <td className="px-3 py-2 text-right">{row.reference}</td>
                <td
                  className={`px-3 py-2 text-right font-semibold ${
                    delta < 0
                      ? 'text-success'
                      : delta > 0
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-muted-foreground'
                  }`}
                >
                  {delta > 0 ? '+' : ''}
                  {delta}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
type AreaResult = {
  total: number;
  counts: Record<string, number>;
  referenceTotal: number | null;
  referenceCounts: Record<string, number> | null;
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
  | 'battery'
  | 'hammer';
type ConsumableId = 'visor' | 'crystal' | 'drone' | 'hammer';
type ConsumableInventory = Record<ConsumableId, number>;
type EquipmentInstance = {
  uid: string;
  id: EquipmentId;
  stars: number;
};
type AidUnlocks = {
  logic: string[];
  golden: string[];
  hints: Record<string, number>;
};
type DropReward =
  | { kind: 'consumable'; id: ConsumableId; quantity: number }
  | { kind: 'equipment'; id: EquipmentId };
type ElementId = 'fire' | 'water' | 'wind' | 'earth';
type ElementLevels = Record<ElementId, number>;
type ElementLoadout = ElementId | 'four-roots' | null;
type BattleStatus = 'idle' | 'running' | 'success' | 'failure';
type DailyProgress = {
  lastCheckIn: string;
  streak: number;
  rewardCredits: number;
  questDate: string;
  questClaimed: boolean;
};
const emptyElementLevels: ElementLevels = {
  fire: 0,
  water: 0,
  wind: 0,
  earth: 0,
};
const starterConsumables: ConsumableInventory = {
  visor: 20,
  crystal: 20,
  drone: 50,
  hammer: 0,
};
const emptyAidUnlocks: AidUnlocks = { logic: [], golden: [], hints: {} };
const emptyDailyProgress: DailyProgress = {
  lastCheckIn: '',
  streak: 0,
  rewardCredits: 0,
  questDate: '',
  questClaimed: false,
};
const storageKeys = {
  schemaVersion: 'soc-rtl-lab:schema-version',
  locale: 'soc-rtl-lab:locale',
  solved: 'soc-rtl-lab:solved',
  code: 'soc-rtl-lab:solutions',
  mascotGender: 'soc-rtl-lab:mascot-gender',
  mascotProfession: 'soc-rtl-lab:mascot-profession',
  ownedEquipment: 'soc-rtl-lab:owned-equipment',
  equippedEquipment: 'soc-rtl-lab:equipped-equipment',
  equipmentInventory: 'soc-rtl-lab:equipment-inventory',
  equippedEquipmentUid: 'soc-rtl-lab:equipped-equipment-uid',
  equipmentSpend: 'soc-rtl-lab:equipment-spend',
  equipmentStars: 'soc-rtl-lab:equipment-stars',
  enhancementSpend: 'soc-rtl-lab:enhancement-spend',
  resaleCredits: 'soc-rtl-lab:resale-credits',
  consumables: 'soc-rtl-lab:consumables',
  consumableSpend: 'soc-rtl-lab:consumable-spend',
  aidUnlocks: 'soc-rtl-lab:aid-unlocks',
  elementLevels: 'soc-rtl-lab:element-levels',
  elementSpend: 'soc-rtl-lab:element-spend',
  equippedElement: 'soc-rtl-lab:equipped-element',
  dailyProgress: 'soc-rtl-lab:daily-progress',
  sharedSocEarned: 'academy-shared:v1:soc-earned',
  sharedHbmEarned: 'academy-shared:v1:hbm-earned',
};
let equipmentUidSerial = 0;
function createEquipmentInstance(
  id: EquipmentId,
  stars = 0,
): EquipmentInstance {
  equipmentUidSerial += 1;
  return {
    uid: `${id}-${Date.now().toString(36)}-${equipmentUidSerial.toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    id,
    stars: Math.min(5, Math.max(0, Math.floor(stars))),
  };
}
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

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateOrdinal(key: string) {
  const [year, month, day] = key.split('-').map(Number);
  if (!year || !month || !day) return Number.NaN;
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function dailyChallengeFor(key: string) {
  const seed = Array.from(key).reduce(
    (sum, character, index) => sum + character.charCodeAt(0) * (index + 1),
    0,
  );
  return challenges[seed % challenges.length] ?? challenges[0];
}

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
    goldenPatternNote:
      '表格描述外部可觀察行為，幫你先確認題意；它不是可直接貼上的 RTL 解答。',
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
    mascotCustomize: '夥伴背包',
    mascotShop: '裝備商店',
    backpack: '夥伴背包',
    shop: '點數商店',
    mascotGender: '企鵝性別',
    masculine: '男企鵝',
    feminine: '女企鵝',
    mascotProfession: '職業解鎖',
    mascotDone: '完成',
    mascotDescription:
      '完成指定領域題目可解鎖並裝備職業；商店商品可直接購買，但職業專屬裝備只能由對應職業使用。消費不會降低總分與等級。',
    wallet: '可用點數',
    equipment: '已擁有裝備',
    shopEquipment: '購買裝備',
    learningTools: '學習工具',
    starterTools:
      '新手補給：Debug 護目鏡與 Timing 水晶各 20 個、晶片夥伴 50 個；鍛造鐵鎚可購買或由 BOSS 掉落。',
    quantity: '持有',
    useTool: '使用 1 個',
    unlockedAid: '本題已解鎖',
    sell: '半價出售',
    resaleValue: '回收價',
    bossDrop: 'BOSS 掉落',
    bossDropBody:
      '高階與最終 BOSS 首次通關時有機會掉落學習工具或裝備；同款裝備也能重複取得。',
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
    enchantmentBody:
      '每次強化都會提高戰鬥特效強度；集齊火、水、風、土可解鎖四靈根融合特效。',
    enhance: '強化',
    forge: '裝備衝星',
    forgeChance: '成功率',
    forgeProtected: '失敗保護，不降星',
    forgeDowngrade: '衝星失敗，裝備下降 1 星',
    forgeSuccess: '衝星成功',
    divineGear: '五星神裝',
    maxStars: '已達最高星級',
    forgeNotice:
      '每件裝備會獨立保存星數。拖曳指定裝備到鍛造台，或按下衝星；每次消耗 1 把鐵鎚。最高 5 星，0～1 星失敗不降級，2 星以上失敗下降 1 星，但裝備本體不會消失。',
    forgeStation: '裝備鍛造台',
    forgeDrag: '將裝備拖曳到這裡衝星',
    forgeHammerCount: '鍛造鐵鎚',
    forgeNeedsHammer: '需要 1 把鍛造鐵鎚',
    dailyTraining: '每日 RTL 修練',
    dailyCheckIn: '簽到領 50 金幣',
    checkedIn: '今日已簽到',
    streak: '連續簽到',
    streakReward: '第 7 天加碼 150 金幣與 1 把鐵鎚',
    dailyQuest: '今日複習題',
    dailyQuestReward: '通過可領 80 金幣',
    dailyQuestDone: '今日獎勵已領取',
    goDailyQuest: '前往挑戰',
    dailyReviewMode: '每日重做模式',
    dailyReviewModeBody:
      '從 Starter code 重新開始；這份草稿不會覆蓋原答案。已完成題目的提示、Golden 與推演卡在本次複習中暫時關閉。',
    level: '階',
    fourRoots: '四靈根已解鎖',
    activeElement: '出戰屬性',
    noElement: '無屬性',
    fourRootsEquip: '四靈根融合',
    noOwnedEquipment: '尚未擁有裝備，可到點數商店購買。',
    battleRunning: '正在攻擊 RTL 稻草人，逐拍檢查你的電路…',
    battleSuccess: '測試命中！所有測資通過。',
    battleFailure: '稻草人擋下攻擊；從第一個 mismatch 開始除錯。',
    mascotInteract: '點企鵝互動',
    support: '贊助開發',
    supportBody:
      '目前可透過 PayPal.Me 自願支持；款項不會增加遊戲點數，也不是可抵稅的公益捐款。如需其他贊助管道，歡迎透過作者網站聯絡。',
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
    goldenPatternNote:
      'This table defines observable behavior so you can confirm the contract before coding. It is not a paste-ready RTL solution.',
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
    mascotCustomize: 'Companion backpack',
    mascotShop: 'Equipment shop',
    backpack: 'Companion backpack',
    shop: 'Point shop',
    mascotGender: 'Penguin gender',
    masculine: 'Male penguin',
    feminine: 'Female penguin',
    mascotProfession: 'Profession unlocks',
    mascotDone: 'Done',
    mascotDescription:
      'Solve domain challenges to unlock and equip professions. Any affordable shop item can be purchased, but profession gear can only be equipped by its matching class. Spending never reduces your score or rank.',
    wallet: 'Spendable points',
    equipment: 'Owned equipment',
    shopEquipment: 'Buy equipment',
    learningTools: 'Learning tools',
    starterTools:
      'Starter supply: 20 Debug Visors, 20 Timing Crystals, and 50 Chip Companions. Forge Hammers are sold or dropped by bosses.',
    quantity: 'Owned',
    useTool: 'Use one',
    unlockedAid: 'Unlocked for this challenge',
    sell: 'Sell at half price',
    resaleValue: 'Resale',
    bossDrop: 'BOSS drop',
    bossDropBody:
      'Advanced and final bosses may drop learning tools or equipment on the first clear. Duplicate gear can drop.',
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
    enchantmentBody:
      'Each upgrade intensifies the visible battle effect. Collect fire, water, wind, and earth to unlock the Four Roots fusion.',
    enhance: 'Enhance',
    forge: 'Star upgrade',
    forgeChance: 'Success rate',
    forgeProtected: 'Protected failure: no star lost',
    forgeDowngrade: 'Upgrade failed: gear lost one star',
    forgeSuccess: 'Upgrade succeeded',
    divineGear: 'Five-star Divine Gear',
    maxStars: 'Maximum star level',
    forgeNotice:
      'Every copy keeps its own star level. Drag a specific copy onto the forge or use its upgrade button. Each attempt consumes one hammer. Maximum 5 stars; failures at 0–1 are protected and failures at 2+ lose one star, but gear is never destroyed.',
    forgeStation: 'Equipment forge',
    forgeDrag: 'Drag owned gear here to upgrade it',
    forgeHammerCount: 'Forge Hammers',
    forgeNeedsHammer: 'One Forge Hammer required',
    dailyTraining: 'Daily RTL training',
    dailyCheckIn: 'Check in for 50 coins',
    checkedIn: 'Checked in today',
    streak: 'Check-in streak',
    streakReward: 'Day 7 adds 150 coins and one hammer',
    dailyQuest: 'Daily review',
    dailyQuestReward: 'Pass it for 80 coins',
    dailyQuestDone: 'Daily reward claimed',
    goDailyQuest: 'Go to challenge',
    dailyReviewMode: 'Daily fresh-start mode',
    dailyReviewModeBody:
      'Start again from the starter code. This temporary draft never overwrites your saved answer; hints, Golden behavior, and reasoning cards stay hidden when reviewing a solved challenge.',
    level: 'Lv.',
    fourRoots: 'Four Roots unlocked',
    activeElement: 'Active element',
    noElement: 'No element',
    fourRootsEquip: 'Four Roots fusion',
    noOwnedEquipment:
      'No equipment owned yet. Visit the point shop to buy one.',
    battleRunning:
      'Attacking the RTL dummy and checking your design cycle by cycle…',
    battleSuccess: 'Direct hit! Every test passed.',
    battleFailure:
      'The dummy blocked the attack. Debug from the first mismatch.',
    mascotInteract: 'Interact with the penguin',
    support: 'Support development',
    supportBody:
      'Voluntary support is available through PayPal.Me. Payments do not grant game points and are not tax-deductible charitable donations. Contact the author through the portfolio site if you need another support method.',
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
  cpuBlade: {
    icon: 'sword',
    cost: 360,
    profession: 'cpu',
    name: { zh: 'Forwarding 光刃', en: 'Forwarding Blade' },
    effect: {
      zh: '把資料相依化成可追蹤的旁路斬擊。',
      en: 'Turns data dependencies into a traceable bypass strike.',
    },
  },
  cpuShield: {
    icon: 'shield',
    cost: 480,
    profession: 'cpu',
    name: { zh: 'Pipeline 護盾', en: 'Pipeline Shield' },
    effect: {
      zh: '提醒你同步檢查 stall、flush 與 valid。',
      en: 'Keeps stall, flush, and valid aligned during debug.',
    },
  },
  socQuiver: {
    icon: 'target',
    cost: 360,
    profession: 'soc',
    name: { zh: 'AXI 箭匣', en: 'AXI Quiver' },
    effect: {
      zh: '瞄準 ready／valid、burst 與 backpressure。',
      en: 'Targets ready/valid, bursts, and backpressure.',
    },
  },
  socCompass: {
    icon: 'network',
    cost: 500,
    profession: 'soc',
    name: { zh: 'Interconnect 羅盤', en: 'Interconnect Compass' },
    effect: {
      zh: '沿著 address map 與資料流定位整合錯誤。',
      en: 'Traces integration faults through address maps and dataflow.',
    },
  },
  dftLantern: {
    icon: 'healer',
    cost: 350,
    profession: 'dft',
    name: { zh: 'Scan 診斷燈', en: 'Scan Diagnostic Lantern' },
    effect: {
      zh: '照亮可控制性、可觀察性與未知值來源。',
      en: 'Illuminates controllability, observability, and X sources.',
    },
  },
  dftProbe: {
    icon: 'scan',
    cost: 480,
    profession: 'dft',
    name: { zh: 'Fault 探針', en: 'Fault Probe' },
    effect: {
      zh: '追蹤 stuck-at、transition 與 MBIST failure。',
      en: 'Tracks stuck-at, transition, and MBIST failures.',
    },
  },
  timingGrimoire: {
    icon: 'book',
    cost: 400,
    profession: 'timing',
    name: { zh: 'STA 魔導書', en: 'STA Grimoire' },
    effect: {
      zh: '把 clock、constraint 與 path report 串成因果。',
      en: 'Connects clocks, constraints, and path reports into one cause.',
    },
  },
  lowPowerCharm: {
    icon: 'battery',
    cost: 500,
    profession: 'timing',
    name: { zh: 'Low-Power 月墜', en: 'Low-Power Moon Charm' },
    effect: {
      zh: '守護 clock gating、isolation 與 retention 順序。',
      en: 'Guards clock gating, isolation, and retention sequencing.',
    },
  },
};

const consumableCatalog: Record<
  ConsumableId,
  {
    icon: EquipmentIconId;
    artwork?: { src: string };
    cost: number;
    name: { zh: string; en: string };
    effect: { zh: string; en: string };
  }
> = {
  visor: {
    icon: 'visor',
    artwork: { src: './mascot/equipment-visor.png' },
    cost: 120,
    name: { zh: 'Debug 護目鏡', en: 'Debug Visor' },
    effect: {
      zh: '消耗 1 個，永久解鎖該題 Golden pattern。',
      en: 'Spend one to permanently unlock a challenge Golden pattern.',
    },
  },
  crystal: {
    icon: 'crystal',
    artwork: { src: './mascot/equipment-crystal.png' },
    cost: 140,
    name: { zh: 'Timing 水晶', en: 'Timing Crystal' },
    effect: {
      zh: '消耗 1 個，永久解鎖該題的關鍵邏輯整理。',
      en: 'Spend one to permanently unlock a challenge logic brief.',
    },
  },
  drone: {
    icon: 'drone',
    artwork: { src: './mascot/equipment-drone.png' },
    cost: 60,
    name: { zh: '晶片夥伴', en: 'Chip Companion' },
    effect: {
      zh: '每次消耗 1 個，永久解鎖下一層提示。',
      en: 'Spend one to permanently unlock the next hint layer.',
    },
  },
  hammer: {
    icon: 'hammer',
    cost: 220,
    name: { zh: '鍛造鐵鎚', en: 'Forge Hammer' },
    effect: {
      zh: '每次裝備衝星消耗 1 把；高階 BOSS 也可能掉落。',
      en: 'Consumed by each gear upgrade; advanced bosses may also drop it.',
    },
  },
};

const elementCatalog: Record<
  ElementId,
  {
    name: { zh: string; en: string };
    effect: { zh: string; en: string };
    className: string;
  }
> = {
  fire: {
    name: { zh: '火屬性石', en: 'Fire Stone' },
    effect: {
      zh: '失敗時標亮第一個 mismatch，像熱點一樣聚焦 root cause。',
      en: 'Highlights the first mismatch like a hotspot around the root cause.',
    },
    className: 'element-fire',
  },
  water: {
    name: { zh: '水屬性石', en: 'Water Stone' },
    effect: {
      zh: '讓波形比較更清楚，強調訊號前後週期的流動。',
      en: 'Clarifies waveform comparison and cycle-to-cycle signal flow.',
    },
    className: 'element-water',
  },
  wind: {
    name: { zh: '風屬性石', en: 'Wind Stone' },
    effect: {
      zh: '加強編譯與 regression 的速度感，提醒先縮小失敗範圍。',
      en: 'Adds regression speed and reminds you to narrow the failing scope.',
    },
    className: 'element-wind',
  },
  earth: {
    name: { zh: '土屬性石', en: 'Earth Stone' },
    effect: {
      zh: '強調 assertion、邊界條件與可重現測資的穩定基礎。',
      en: 'Reinforces assertions, boundaries, and reproducible tests.',
    },
    className: 'element-earth',
  },
};

const elementUpgradeCost = (level: number) => Math.min(500, 260 + level * 80);
const equipmentUpgradeChance = [1, 0.8, 0.65, 0.45, 0.3] as const;
const equipmentUpgradeRate = (stars: number) =>
  equipmentUpgradeChance[Math.min(4, Math.max(0, stars))] ?? 0;

function rollEquipmentUpgrade(stars: number) {
  const sample = new Uint32Array(1);
  globalThis.crypto.getRandomValues(sample);
  return (sample[0] ?? 0) / 0x1_0000_0000 < equipmentUpgradeRate(stars);
}

function EquipmentIcon({
  id,
  className = '',
}: {
  id: EquipmentIconId;
  className?: string;
}) {
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
    hammer: Hammer,
  };
  const Icon = icons[id];
  return <Icon className={className} aria-hidden="true" />;
}

function EquipmentStarRow({ stars }: { stars: number }) {
  return (
    <span className="equipment-star-row" aria-label={`${stars} / 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          className={index < stars ? 'is-filled' : ''}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

function EquipmentArtwork({
  src,
  className = '',
}: {
  src: string;
  className?: string;
}) {
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
  equipmentStarLevel = 0,
  elements = emptyElementLevels,
  equippedElement = null,
  className = '',
}: {
  gender: MascotGender;
  profession: MascotProfession;
  tier: number;
  equipment?: EquipmentId | null;
  equipmentStarLevel?: number;
  elements?: ElementLevels;
  equippedElement?: ElementLoadout;
  className?: string;
}) {
  const image =
    gender === 'masculine' && profession === 'soc'
      ? './mascot/penguin-masculine-soc-v2.png'
      : `./mascot/penguin-${gender}-${profession}.png`;
  const selectedElement =
    equippedElement &&
    equippedElement !== 'four-roots' &&
    elements[equippedElement] > 0
      ? equippedElement
      : null;
  const rootsEquipped =
    equippedElement === 'four-roots' &&
    Object.values(elements).every((level) => level > 0);
  const equippedItem = equipment ? equipmentCatalog[equipment] : null;
  return (
    <div
      className={`mascot-avatar mascot-tier-${tier} mascot-gender-${gender} mascot-profession-${profession} ${equipmentStarLevel > 0 ? 'equipment-starred' : ''} ${equipmentStarLevel >= 5 ? 'equipment-divine' : ''} ${selectedElement ? `mascot-enchanted mascot-enchanted-${selectedElement}` : ''} ${rootsEquipped ? 'mascot-enchanted mascot-four-roots' : ''} relative overflow-visible ${className}`}
      style={{ '--gear-stars': equipmentStarLevel } as CSSProperties}
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
      {(selectedElement || rootsEquipped) && (
        <span className="mascot-element-cloak" aria-hidden="true" />
      )}
      {rootsEquipped && (
        <span className="mascot-roots-orbit" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
      )}
      <span className="mascot-tier-ornament" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span className="mascot-gender-emblem" aria-hidden="true">
        {gender === 'masculine' ? <Mars /> : <Venus />}
      </span>
      {equipment && equippedItem && (
        <div
          className={`mascot-equipment mascot-equipment-${equippedItem.profession}`}
        >
          {equippedItem.artwork ? (
            <EquipmentArtwork src={equippedItem.artwork.src} />
          ) : (
            <EquipmentIcon
              id={equippedItem.icon}
              className="mascot-equipment-icon"
            />
          )}
        </div>
      )}
    </div>
  );
}

function BattleArena({
  locale,
  gender,
  profession,
  tier,
  equipment,
  equipmentStarLevel,
  elements,
  equippedElement,
  status,
  enemy,
  coinReward,
  dropReward,
}: {
  locale: Locale;
  gender: MascotGender;
  profession: MascotProfession;
  tier: number;
  equipment: EquipmentId | null;
  equipmentStarLevel: number;
  elements: ElementLevels;
  equippedElement: ElementLoadout;
  status: BattleStatus;
  enemy: EnemyKind;
  coinReward: number | null;
  dropReward: DropReward | null;
}) {
  const enemyCatalog: Record<
    EnemyKind,
    { src: string; label: string; boss: boolean; final: boolean }
  > = {
    'training-dummy': {
      src: './mascot/rtl-training-dummy-display.png',
      label: 'RTL DUMMY',
      boss: false,
      final: false,
    },
    'chip-cat': {
      src: './mascot/chip-cat.png',
      label: 'VENOM CAT',
      boss: false,
      final: false,
    },
    'laser-bear': {
      src: './mascot/laser-bear-v3.webp',
      label: 'THUNDER BEAR',
      boss: false,
      final: false,
    },
    'timing-boss': {
      src: './mascot/gate-level-timing-boss-display.png',
      label: 'TIMING BOSS',
      boss: true,
      final: false,
    },
    'cosmic-emperor': {
      src: './mascot/cosmic-dark-emperor.png',
      label: 'DARK IMMORTAL',
      boss: true,
      final: true,
    },
  };
  const opponent = enemyCatalog[enemy];
  const rootsUnlocked = Object.values(elements).every((level) => level > 0);
  const rootsEquipped = equippedElement === 'four-roots' && rootsUnlocked;
  const dominantElement =
    equippedElement &&
    equippedElement !== 'four-roots' &&
    elements[equippedElement] > 0
      ? equippedElement
      : null;
  const activeElements = rootsEquipped
    ? (Object.keys(elements) as ElementId[])
    : dominantElement
      ? [dominantElement]
      : [];
  const totalElementLevel = activeElements.reduce(
    (sum, element) => sum + elements[element],
    0,
  );
  const battleStyle = {
    '--effect-level': Math.min(5, Math.max(1, totalElementLevel)),
    '--gear-stars': equipmentStarLevel,
  } as CSSProperties;

  return (
    <div
      className={`mascot-battle-arena battle-${status} profession-${profession} enemy-${enemy} ${equipmentStarLevel > 0 ? 'gear-starred' : ''} ${equipmentStarLevel >= 5 ? 'gear-divine' : ''} ${dominantElement ? `battle-element-${dominantElement}` : ''} ${opponent.boss ? 'boss-battle' : ''} ${opponent.final ? 'final-boss-battle' : ''} ${rootsEquipped ? 'four-roots-active' : ''}`}
      style={battleStyle}
      aria-hidden="true"
    >
      <div className="mascot-battle-actor">
        <MascotAvatar
          gender={gender}
          profession={profession}
          tier={tier}
          equipment={equipment}
          equipmentStarLevel={equipmentStarLevel}
          elements={elements}
          equippedElement={equippedElement}
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
            style={
              {
                '--stone-level': Math.min(5, elements[element]),
              } as CSSProperties
            }
          />
        ))}
      </div>
      <div
        className={`rtl-dummy-wrap enemy-target-wrap ${opponent.boss ? 'boss-target-wrap' : ''}`}
        aria-hidden="true"
      >
        <span className="dummy-hit-ring" />
        <img
          src={opponent.src}
          alt=""
          width={opponent.final ? 760 : opponent.boss ? 560 : 640}
          height={opponent.final ? 695 : opponent.boss ? 512 : 585}
          decoding="async"
          className={opponent.boss ? 'rtl-boss' : 'rtl-dummy'}
        />
        {opponent.boss && (
          <>
            <span className="boss-shard boss-shard-a" />
            <span className="boss-shard boss-shard-b" />
            <span className="boss-shard boss-shard-c" />
          </>
        )}
        <span className="rtl-dummy-label">{opponent.label}</span>
      </div>
      <span className="battle-screen-flash" />
      {opponent.final && (
        <>
          <span className="boss-counterattack-beam" />
          <span className="boss-counterattack-seal" />
        </>
      )}
      <span className="failure-impact" />
      <span className="failure-damage-mark">!</span>
      <span className="victory-seal">PASS</span>
      <span className="celebration-burst">
        {Array.from({ length: 10 }, (_, index) => (
          <i key={index} />
        ))}
      </span>
      {status === 'success' && coinReward !== null && (
        <span className="coin-reward-toast">
          <span aria-hidden="true">●</span> +{coinReward}
        </span>
      )}
      {status === 'success' && dropReward && (
        <span className="drop-reward-toast">
          <Gift aria-hidden="true" />
          {dropReward.kind === 'consumable'
            ? `${consumableCatalog[dropReward.id].name[locale]} × ${dropReward.quantity}`
            : equipmentCatalog[dropReward.id].name[locale]}
        </span>
      )}
    </div>
  );
}

const finalBossChallenges = new Set([
  'cdc-async-fifo',
  'soc-cache-two-way',
  'soc-cache-miss-fsm',
  'lp-power-sequencer',
  'soc-streaming-llm-tile',
]);

function enemyForChallenge(
  id: string,
  difficulty: string,
  order: number,
): EnemyKind {
  if (order <= 10) return 'training-dummy';
  if (finalBossChallenges.has(id)) return 'cosmic-emperor';
  if (difficulty === 'advanced') return 'timing-boss';
  if (difficulty === 'intermediate') return 'laser-bear';
  return 'chip-cat';
}

function AidUnlockCard({
  id,
  count,
  locale,
  onUnlock,
}: {
  id: ConsumableId;
  count: number;
  locale: Locale;
  onUnlock: () => void;
}) {
  const item = consumableCatalog[id];
  return (
    <div className="mt-4 flex flex-col gap-3 rounded-xl border border-dashed border-primary/30 bg-primary/[0.035] p-3 sm:flex-row sm:items-center">
      <div className="equipment-shop-icon shrink-0">
        {item.artwork ? (
          <EquipmentArtwork src={item.artwork.src} />
        ) : (
          <EquipmentIcon id={item.icon} className="equipment-shop-main-icon" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{item.name[locale]}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {item.effect[locale]}
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="shrink-0"
        disabled={count < 1}
        onClick={onUnlock}
      >
        <Sparkles />
        {locale === 'zh' ? '使用 1 個' : 'Use one'} · × {count}
      </Button>
    </div>
  );
}

const logicAnalogy: Record<TrackId, { zh: string; en: string }> = {
  rtl: {
    zh: '把暫存器想成只在鐘聲響起時拍照的相機；組合邏輯則像即時計算機，輸入一變，答案就跟著變。',
    en: 'Think of a register as a camera that takes a picture only when the clock rings. Combinational logic is a live calculator whose answer follows its inputs.',
  },
  cdc: {
    zh: '兩個 clock domain 像兩個走不同節拍的房間。不能直接把東西丟過去，要用同步器或握手，確認對方真的接到了。',
    en: 'Two clock domains are rooms moving to different rhythms. Do not throw data straight across; use a synchronizer or handshake so the receiver can accept it safely.',
  },
  timing: {
    zh: '資料像趕下一班車：太晚到是 setup violation，太早衝進下一站是 hold violation。Pipeline 就是在長路中間增設轉運站。',
    en: 'Data is catching the next train: arriving too late is a setup violation, while racing into the next stop too early is a hold violation. A pipeline adds transfer stations along a long route.',
  },
  'cpu-cache': {
    zh: 'CPU 像流水線工廠，Cache 像工作台旁的小倉庫。先看資料在不在、前後工序會不會撞車，再決定等待、轉送或重做。',
    en: 'A CPU is an assembly line and a cache is the small shelf beside it. Check whether data is present and whether stages conflict before waiting, forwarding, or restarting work.',
  },
  soc: {
    zh: '介面像交接包裹：送方說「貨到了」，收方說「我能收」，兩句同拍成立才算真正交貨；包裹內容也必須在那一拍保持不變。',
    en: 'An interface is a parcel handoff: the sender says “valid” and the receiver says “ready.” The transfer happens only when both agree in the same cycle, with the parcel kept stable.',
  },
  verification: {
    zh: '把 Golden model 想成標準答案，把 DUT 想成考生答案。要先把同一題、同一拍或同一個 ID 對齊，才能公平比較。',
    en: 'Treat the Golden model as the answer key and the DUT as the student answer. Match the same transaction, cycle, or ID before comparing them.',
  },
  ppa: {
    zh: '像整理行李箱：功能是必帶物品，位寬、運算器與暫存器是占用空間。先確定東西沒少，再減少不必要的尺寸或共用工具。',
    en: 'Think of packing a suitcase: function is what must arrive, while widths, operators, and registers consume space. Keep every required item, then trim or share the bulky parts.',
  },
  dft: {
    zh: 'DFT 像設備的維修模式：平常照常工作，測試時則打開檢修通道，讓內部狀態能被送入、移動並讀出。',
    en: 'DFT is a maintenance mode: normal operation stays unchanged, while test mode opens a service path so internal state can be loaded, shifted, and observed.',
  },
  'low-power': {
    zh: '像關閉大樓某一層：先把工作收尾、保存資料、關上對外通道，最後才能斷電；上電時則反方向恢復。',
    en: 'It is like shutting down one floor of a building: finish work, save state, close external doors, then cut power. Power-up restores those steps in reverse.',
  },
};

function LogicBriefCard({
  challenge,
  locale,
}: {
  challenge: Challenge;
  locale: Locale;
}) {
  const keySteps = challenge.hints
    .slice(0, 2)
    .map((item) => localize(item, locale))
    .join(' ');
  const firstRule = localize(challenge.specs[0], locale);
  const checks = challenge.testGroups
    .map((item) => localize(item, locale))
    .join(locale === 'zh' ? '、' : ', ');
  return (
    <section
      className="logic-brief-card mt-4"
      aria-label="Timing Crystal logic brief"
    >
      <div>
        <Clock3 />
        <span>
          {locale === 'zh'
            ? 'Timing 水晶推演卡'
            : 'Timing Crystal reasoning card'}
        </span>
      </div>
      <dl>
        <dt>{locale === 'zh' ? '先把它想成' : 'Picture it this way'}</dt>
        <dd>{logicAnalogy[challenge.track][locale]}</dd>
        <dt>{locale === 'zh' ? '這題先做什麼' : 'What to do first'}</dt>
        <dd>{keySteps || firstRule}</dd>
        <dt>{locale === 'zh' ? '怎樣才算做對' : 'How to know it works'}</dt>
        <dd>
          {firstRule}{' '}
          {locale === 'zh' ? `再測：${checks}。` : `Then test: ${checks}.`}
        </dd>
      </dl>
    </section>
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
  const [coinReward, setCoinReward] = useState<number | null>(null);
  const [dropReward, setDropReward] = useState<DropReward | null>(null);
  const [engineReady, setEngineReady] = useState(false);
  const [holdLab, setHoldLab] = useState<HoldLabState>({ ...initialHoldLab });
  const [areaResult, setAreaResult] = useState<AreaResult | null>(null);
  const [areaError, setAreaError] = useState('');
  const [estimating, setEstimating] = useState(false);
  const [waveforms, setWaveforms] = useState({ current: '', golden: '' });
  const [mascotGender, setMascotGender] = useState<MascotGender>('masculine');
  const [mascotProfession, setMascotProfession] =
    useState<MascotProfession>('novice');
  const [equipmentInventory, setEquipmentInventory] = useState<
    EquipmentInstance[]
  >([]);
  const [equippedEquipmentUid, setEquippedEquipmentUid] = useState<
    string | null
  >(null);
  const [equipmentSpend, setEquipmentSpend] = useState(0);
  const [enhancementSpend, setEnhancementSpend] = useState(0);
  const [enhancementOutcome, setEnhancementOutcome] = useState<{
    uid: string;
    id: EquipmentId;
    success: boolean;
    before: number;
    after: number;
  } | null>(null);
  const [forgeDragActive, setForgeDragActive] = useState(false);
  const [resaleCredits, setResaleCredits] = useState(0);
  const [consumables, setConsumables] = useState<ConsumableInventory>({
    ...starterConsumables,
  });
  const [consumableSpend, setConsumableSpend] = useState(0);
  const [aidUnlocks, setAidUnlocks] = useState<AidUnlocks>({
    ...emptyAidUnlocks,
    hints: {},
  });
  const [elementLevels, setElementLevels] = useState<ElementLevels>({
    ...emptyElementLevels,
  });
  const [equippedElement, setEquippedElement] = useState<ElementLoadout>(null);
  const [elementSpend, setElementSpend] = useState(0);
  const [todayKey, setTodayKey] = useState('');
  const [dailyProgress, setDailyProgress] = useState<DailyProgress>({
    ...emptyDailyProgress,
  });
  const [hbmEarnedPoints, setHbmEarnedPoints] = useState(0);
  const [dailyReview, setDailyReview] = useState<{
    date: string;
    challengeId: string;
    draft: string;
  } | null>(null);
  const [mascotPanel, setMascotPanel] = useState<'backpack' | 'shop'>(
    'backpack',
  );
  const [mascotTapNonce, setMascotTapNonce] = useState(0);
  const [mascotIsTapping, setMascotIsTapping] = useState(false);
  const [mascotInteraction, setMascotInteraction] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const pendingRequest = useRef<string | null>(null);
  const pendingSynth = useRef<string | null>(null);
  const runWatchdogTimer = useRef<number | null>(null);
  const synthWatchdogTimer = useRef<number | null>(null);
  const instantJudgeTimer = useRef<number | null>(null);
  const battleReturnTimer = useRef<number | null>(null);
  const runStartedAt = useRef(0);
  const synthStartedAt = useRef(0);
  const storageLoaded = useRef(false);
  const current =
    challenges.find((item) => item.id === selectedId) ?? challenges[0];
  const dailyChallenge = dailyChallengeFor(todayKey || '2026-01-01');
  const context = learningContext[current.id];
  const goldenPattern = goldenPatterns[current.id];
  const socLearningAid = socLearningAids[current.id];
  const text = copy[locale];
  const starterCode = useMemo(
    () => formatCodeForEditor(current.starter, current.language),
    [current.starter, current.language],
  );
  const dailyReviewActive =
    dailyReview?.date === todayKey && dailyReview.challengeId === current.id;
  const dailyReviewNoAids = dailyReviewActive && solved.includes(current.id);
  const code = dailyReviewActive
    ? dailyReview.draft
    : (solutions[current.id] ?? starterCode);
  const referenceCode = useMemo(
    () =>
      current.referenceSolution ??
      referenceSolutions[current.id]?.(current.starter) ??
      '',
    [current],
  );

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
      setCoinReward(null);
      setDropReward(null);
      battleReturnTimer.current = null;
    }, 2200);
  }, []);

  const clearRunWatchdog = useCallback(() => {
    if (runWatchdogTimer.current !== null) {
      window.clearTimeout(runWatchdogTimer.current);
      runWatchdogTimer.current = null;
    }
  }, []);

  const clearSynthWatchdog = useCallback(() => {
    if (synthWatchdogTimer.current !== null) {
      window.clearTimeout(synthWatchdogTimer.current);
      synthWatchdogTimer.current = null;
    }
  }, []);

  const awardDailyQuest = useCallback(
    (id: string) => {
      if (!todayKey || id !== dailyChallenge.id) return;
      setDailyProgress((previous) => {
        if (previous.questDate === todayKey && previous.questClaimed === true)
          return previous;
        return {
          ...previous,
          questDate: todayKey,
          questClaimed: true,
          rewardCredits: previous.rewardCredits + 80,
        };
      });
    },
    [dailyChallenge.id, todayKey],
  );

  const markSolved = useCallback(
    (id: string) => {
      awardDailyQuest(id);
      if (solved.includes(id)) return false;
      const solvedChallenge = challenges.find((item) => item.id === id);
      const next = [...solved, id];
      setSolved(next);
      browserStorage.setItem(storageKeys.solved, JSON.stringify(next));
      setCoinReward(solvedChallenge?.points ?? 0);

      const isDropBoss =
        solvedChallenge?.difficulty === 'advanced' ||
        finalBossChallenges.has(id);
      if (isDropBoss) {
        const roll = Math.random();
        const consumableIds = Object.keys(consumableCatalog) as ConsumableId[];
        const grantConsumable = () => {
          const item =
            consumableIds[Math.floor(Math.random() * consumableIds.length)];
          const quantity = 2 + Math.floor(Math.random() * 4);
          setConsumables((previous) => ({
            ...previous,
            [item]: previous[item] + quantity,
          }));
          setDropReward({ kind: 'consumable', id: item, quantity });
        };

        if (roll < 0.62) {
          grantConsumable();
        } else if (roll < 0.77) {
          const equipmentIds = Object.keys(equipmentCatalog) as EquipmentId[];
          const item =
            equipmentIds[Math.floor(Math.random() * equipmentIds.length)];
          setEquipmentInventory((previous) => [
            ...previous,
            createEquipmentInstance(item),
          ]);
          setDropReward({ kind: 'equipment', id: item });
        } else {
          setDropReward(null);
        }
      } else {
        setDropReward(null);
      }
      return true;
    },
    [awardDailyQuest, solved],
  );

  const selectChallenge = useCallback(
    (id: string) => {
      if (!challenges.some((item) => item.id === id)) return false;
      pendingRequest.current = null;
      pendingSynth.current = null;
      runStartedAt.current = 0;
      synthStartedAt.current = 0;
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'SOC_RTL_CANCEL' },
        window.location.origin,
      );
      setRunning(false);
      setBattleVisible(false);
      setCoinReward(null);
      setDropReward(null);
      setEstimating(false);
      setSelectedId(id);
      setDailyReview(null);
      setResult(null);
      setWaveforms({ current: '', golden: '' });
      setAreaResult(null);
      setAreaError('');
      setHoldLab({ ...initialHoldLab });
      setMascotInteraction('');
      clearRunWatchdog();
      clearSynthWatchdog();
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
    },
    [clearRunWatchdog, clearSynthWatchdog],
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      let restoredSolvedIds: string[] = [];
      setTodayKey(localDateKey(new Date()));
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
      const savedEquipmentInventory = browserStorage.getItem(
        storageKeys.equipmentInventory,
      );
      const savedEquippedEquipmentUid = browserStorage.getItem(
        storageKeys.equippedEquipmentUid,
      );
      const savedEquipmentSpend = browserStorage.getItem(
        storageKeys.equipmentSpend,
      );
      const savedEquipmentStars = browserStorage.getItem(
        storageKeys.equipmentStars,
      );
      const savedEnhancementSpend = browserStorage.getItem(
        storageKeys.enhancementSpend,
      );
      const savedSchemaVersion = Number(
        browserStorage.getItem(storageKeys.schemaVersion) ?? '1',
      );
      const savedResaleCredits = browserStorage.getItem(
        storageKeys.resaleCredits,
      );
      const savedConsumables = browserStorage.getItem(storageKeys.consumables);
      const savedConsumableSpend = browserStorage.getItem(
        storageKeys.consumableSpend,
      );
      const savedAidUnlocks = browserStorage.getItem(storageKeys.aidUnlocks);
      const savedElementLevels = browserStorage.getItem(
        storageKeys.elementLevels,
      );
      const savedElementSpend = browserStorage.getItem(
        storageKeys.elementSpend,
      );
      const savedEquippedElement = browserStorage.getItem(
        storageKeys.equippedElement,
      );
      const savedDailyProgress = browserStorage.getItem(
        storageKeys.dailyProgress,
      );
      const savedHbmEarned = Number(
        browserStorage.getItem(storageKeys.sharedHbmEarned) ?? '0',
      );
      if (Number.isFinite(savedHbmEarned) && savedHbmEarned >= 0)
        setHbmEarnedPoints(savedHbmEarned);
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
        const parsedEquipmentInventory: unknown = JSON.parse(
          savedEquipmentInventory ?? '[]',
        );
        const parsedConsumables: unknown = JSON.parse(
          savedConsumables ?? JSON.stringify(starterConsumables),
        );
        const parsedAidUnlocks: unknown = JSON.parse(
          savedAidUnlocks ?? JSON.stringify(emptyAidUnlocks),
        );
        const parsedElementLevels: unknown = JSON.parse(
          savedElementLevels ?? JSON.stringify(emptyElementLevels),
        );
        const parsedEquipmentStars: unknown = JSON.parse(
          savedEquipmentStars ?? '{}',
        );
        const parsedDailyProgress: unknown = JSON.parse(
          savedDailyProgress ?? JSON.stringify(emptyDailyProgress),
        );
        if (Array.isArray(parsedSolved)) {
          restoredSolvedIds = [
            ...new Set(
              parsedSolved.filter(
                (id) =>
                  typeof id === 'string' &&
                  challenges.some((item) => item.id === id),
              ),
            ),
          ];
          setSolved(restoredSolvedIds);
        }
        const migratedOwned = Array.isArray(parsedOwnedEquipment)
          ? [
              ...new Set(
                parsedOwnedEquipment.filter(
                  (id): id is EquipmentId =>
                    typeof id === 'string' && id in equipmentCatalog,
                ),
              ),
            ]
          : [];
        const migratedInventory: EquipmentInstance[] = [];
        const seenEquipmentUids = new Set<string>();
        if (
          savedEquipmentInventory !== null &&
          Array.isArray(parsedEquipmentInventory)
        ) {
          parsedEquipmentInventory.forEach((raw) => {
            if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return;
            const item = raw as Partial<EquipmentInstance>;
            if (
              typeof item.uid !== 'string' ||
              seenEquipmentUids.has(item.uid) ||
              typeof item.id !== 'string' ||
              !(item.id in equipmentCatalog)
            )
              return;
            seenEquipmentUids.add(item.uid);
            migratedInventory.push({
              uid: item.uid,
              id: item.id as EquipmentId,
              stars: Math.min(
                5,
                Math.max(0, Math.floor(Number(item.stars) || 0)),
              ),
            });
          });
        } else {
          migratedOwned.forEach((id) => {
            const legacyStars =
              parsedEquipmentStars &&
              typeof parsedEquipmentStars === 'object' &&
              !Array.isArray(parsedEquipmentStars)
                ? Number((parsedEquipmentStars as Record<string, unknown>)[id])
                : 0;
            migratedInventory.push(
              createEquipmentInstance(
                id,
                Number.isFinite(legacyStars) ? legacyStars : 0,
              ),
            );
          });
        }
        setEquipmentInventory(migratedInventory);
        const restoredEquippedUid =
          savedEquippedEquipmentUid &&
          migratedInventory.some(
            (item) => item.uid === savedEquippedEquipmentUid,
          )
            ? savedEquippedEquipmentUid
            : migratedInventory.find(
                (item) => item.id === savedEquippedEquipment,
              )?.uid;
        setEquippedEquipmentUid(restoredEquippedUid ?? null);
        {
          const parsedSpend = Number(savedEquipmentSpend);
          if (
            savedEquipmentSpend !== null &&
            Number.isFinite(parsedSpend) &&
            parsedSpend >= 0
          ) {
            const legacyPrices: Record<EquipmentId, number> = {
              cpuBlade: 900,
              cpuShield: 1450,
              socQuiver: 950,
              socCompass: 1500,
              dftLantern: 850,
              dftProbe: 1400,
              timingGrimoire: 1000,
              lowPowerCharm: 1600,
            };
            const migrationRefund =
              savedSchemaVersion < 3
                ? migratedOwned.reduce(
                    (sum, id) =>
                      sum +
                      Math.max(0, legacyPrices[id] - equipmentCatalog[id].cost),
                    0,
                  ) +
                  (Array.isArray(parsedOwnedEquipment)
                    ? parsedOwnedEquipment
                    : []
                  ).reduce<number>((sum, id: unknown) => {
                    if (id === 'visor') return sum + 600;
                    if (id === 'crystal') return sum + 900;
                    if (id === 'drone') return sum + 1200;
                    return sum;
                  }, 0)
                : 0;
            setEquipmentSpend(Math.max(0, parsedSpend - migrationRefund));
          } else {
            setEquipmentSpend(
              migratedInventory.reduce(
                (sum, item) => sum + equipmentCatalog[item.id].cost,
                0,
              ),
            );
          }
        }
        if (parsedConsumables && typeof parsedConsumables === 'object') {
          setConsumables(
            (Object.keys(starterConsumables) as ConsumableId[]).reduce(
              (next, id) => {
                const value = Number(
                  (parsedConsumables as Record<string, unknown>)[id],
                );
                const normalized = Number.isFinite(value)
                  ? Math.max(0, Math.floor(value))
                  : starterConsumables[id];
                next[id] =
                  savedSchemaVersion < 4 &&
                  savedConsumables !== null &&
                  (id === 'visor' || id === 'crystal')
                    ? Math.max(0, normalized - 30)
                    : normalized;
                return next;
              },
              { ...starterConsumables },
            ),
          );
        }
        if (
          parsedDailyProgress &&
          typeof parsedDailyProgress === 'object' &&
          !Array.isArray(parsedDailyProgress)
        ) {
          const saved = parsedDailyProgress as Partial<DailyProgress>;
          setDailyProgress({
            lastCheckIn:
              typeof saved.lastCheckIn === 'string' ? saved.lastCheckIn : '',
            streak: Math.max(0, Math.floor(Number(saved.streak) || 0)),
            rewardCredits: Math.max(
              0,
              Math.floor(Number(saved.rewardCredits) || 0),
            ),
            questDate:
              typeof saved.questDate === 'string' ? saved.questDate : '',
            questClaimed: saved.questClaimed === true,
          });
        }
        const parsedEnhancementSpend = Number(savedEnhancementSpend);
        if (
          Number.isFinite(parsedEnhancementSpend) &&
          parsedEnhancementSpend >= 0
        )
          setEnhancementSpend(parsedEnhancementSpend);
        const parsedConsumableSpend = Number(savedConsumableSpend);
        if (
          Number.isFinite(parsedConsumableSpend) &&
          parsedConsumableSpend >= 0
        )
          setConsumableSpend(parsedConsumableSpend);
        const parsedResaleCredits = Number(savedResaleCredits);
        if (Number.isFinite(parsedResaleCredits) && parsedResaleCredits >= 0)
          setResaleCredits(parsedResaleCredits);
        if (parsedAidUnlocks && typeof parsedAidUnlocks === 'object') {
          const raw = parsedAidUnlocks as Partial<AidUnlocks>;
          const validIds = new Set(challenges.map((item) => item.id));
          const logic = Array.isArray(raw.logic)
            ? [...new Set(raw.logic.filter((id) => validIds.has(id)))]
            : [];
          const golden = Array.isArray(raw.golden)
            ? [...new Set(raw.golden.filter((id) => validIds.has(id)))]
            : [];
          const hints = Object.fromEntries(
            Object.entries(raw.hints ?? {})
              .filter(([id]) => validIds.has(id))
              .map(([id, value]) => [
                id,
                Math.min(3, Math.max(0, Math.floor(Number(value) || 0))),
              ]),
          );
          setAidUnlocks({ logic, golden, hints });
        }
        if (parsedElementLevels && typeof parsedElementLevels === 'object') {
          const migratedElements = (
            Object.keys(emptyElementLevels) as ElementId[]
          ).reduce(
            (next, element) => {
              const value = Number(
                (parsedElementLevels as Record<string, unknown>)[element],
              );
              next[element] = Number.isFinite(value)
                ? Math.max(0, Math.floor(value))
                : 0;
              return next;
            },
            { ...emptyElementLevels },
          );
          setElementLevels(migratedElements);
          const parsedSpend = Number(savedElementSpend);
          setElementSpend(
            savedElementSpend !== null &&
              Number.isFinite(parsedSpend) &&
              parsedSpend >= 0
              ? parsedSpend
              : (Object.keys(migratedElements) as ElementId[]).reduce(
                  (sum, element) => {
                    let subtotal = 0;
                    for (
                      let level = 0;
                      level < migratedElements[element];
                      level += 1
                    )
                      subtotal += elementUpgradeCost(level);
                    return sum + subtotal;
                  },
                  0,
                ),
          );
          if (
            savedEquippedElement === 'fire' ||
            savedEquippedElement === 'water' ||
            savedEquippedElement === 'wind' ||
            savedEquippedElement === 'earth' ||
            savedEquippedElement === 'four-roots'
          ) {
            setEquippedElement(savedEquippedElement);
          } else {
            const ownedElements = (
              Object.keys(migratedElements) as ElementId[]
            ).filter((element) => migratedElements[element] > 0);
            if (ownedElements.length === 4) setEquippedElement('four-roots');
            else if (ownedElements.length)
              setEquippedElement(
                ownedElements.reduce((best, element) =>
                  migratedElements[element] > migratedElements[best]
                    ? element
                    : best,
                ),
              );
          }
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
      const restoredSocPoints = challenges
        .filter((challenge) => restoredSolvedIds.includes(challenge.id))
        .reduce((sum, challenge) => sum + challenge.points, 0);
      browserStorage.setItem(
        storageKeys.sharedSocEarned,
        String(restoredSocPoints),
      );
      storageLoaded.current = true;
      browserStorage.setItem(storageKeys.schemaVersion, '6');
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
        storageKeys.equipmentInventory,
        JSON.stringify(equipmentInventory),
      );
  }, [equipmentInventory]);
  useEffect(() => {
    if (storageLoaded.current)
      browserStorage.setItem(
        storageKeys.equippedEquipmentUid,
        equippedEquipmentUid ?? '',
      );
  }, [equippedEquipmentUid]);
  useEffect(() => {
    if (storageLoaded.current)
      browserStorage.setItem(
        storageKeys.equipmentSpend,
        String(equipmentSpend),
      );
  }, [equipmentSpend]);
  useEffect(() => {
    if (storageLoaded.current)
      browserStorage.setItem(
        storageKeys.enhancementSpend,
        String(enhancementSpend),
      );
  }, [enhancementSpend]);
  useEffect(() => {
    if (storageLoaded.current)
      browserStorage.setItem(storageKeys.resaleCredits, String(resaleCredits));
  }, [resaleCredits]);
  useEffect(() => {
    if (storageLoaded.current)
      browserStorage.setItem(
        storageKeys.consumables,
        JSON.stringify(consumables),
      );
  }, [consumables]);
  useEffect(() => {
    if (storageLoaded.current)
      browserStorage.setItem(
        storageKeys.consumableSpend,
        String(consumableSpend),
      );
  }, [consumableSpend]);
  useEffect(() => {
    if (storageLoaded.current)
      browserStorage.setItem(
        storageKeys.aidUnlocks,
        JSON.stringify(aidUnlocks),
      );
  }, [aidUnlocks]);
  useEffect(() => {
    if (storageLoaded.current)
      browserStorage.setItem(
        storageKeys.elementLevels,
        JSON.stringify(elementLevels),
      );
  }, [elementLevels]);
  useEffect(() => {
    if (storageLoaded.current)
      browserStorage.setItem(storageKeys.elementSpend, String(elementSpend));
  }, [elementSpend]);
  useEffect(() => {
    if (storageLoaded.current)
      browserStorage.setItem(
        storageKeys.equippedElement,
        equippedElement ?? '',
      );
  }, [equippedElement]);
  useEffect(() => {
    if (storageLoaded.current)
      browserStorage.setItem(
        storageKeys.dailyProgress,
        JSON.stringify(dailyProgress),
      );
  }, [dailyProgress]);
  useEffect(() => {
    if (!storageLoaded.current) return;
    const timer = window.setTimeout(() => {
      browserStorage.setItem(storageKeys.code, JSON.stringify(solutions));
    }, 400);
    return () => window.clearTimeout(timer);
  }, [solutions]);
  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-Hant-TW' : 'en';
  }, [locale]);

  useEffect(() => {
    const target = new Image();
    target.decoding = 'async';
    target.fetchPriority = 'low';
    const enemy = enemyForChallenge(
      current.id,
      current.difficulty,
      current.order,
    );
    target.src = {
      'training-dummy': './mascot/rtl-training-dummy-display.png',
      'chip-cat': './mascot/chip-cat.png',
      'laser-bear': './mascot/laser-bear-v3.webp',
      'timing-boss': './mascot/gate-level-timing-boss-display.png',
      'cosmic-emperor': './mascot/cosmic-dark-emperor.png',
    }[enemy];
  }, [current.id, current.difficulty, current.order]);

  useEffect(() => {
    if (engineReady) return;
    let attempts = 0;
    let timer: number | null = null;
    const ping = () => {
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'SOC_RTL_ENGINE_PING' },
        window.location.origin,
      );
      attempts += 1;
      if (attempts < 12) timer = window.setTimeout(ping, 750);
    };
    ping();
    return () => {
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [engineReady]);

  useEffect(() => {
    const recoverAfterSuspend = () => {
      document.documentElement.classList.toggle('page-hidden', document.hidden);
      if (document.hidden) return;

      const now = Date.now();
      let cancelledStaleWork = false;
      if (pendingRequest.current && now - runStartedAt.current > 50000) {
        pendingRequest.current = null;
        runStartedAt.current = 0;
        cancelledStaleWork = true;
        clearRunWatchdog();
        setRunning(false);
        setBattleVisible(false);
        setResult({
          ok: false,
          phase: 'engine',
          console:
            locale === 'zh'
              ? '頁面閒置期間測試環境失去回應，已自動解除鎖定；請重新執行。'
              : 'The runtime stopped responding while the page was idle. The UI has been unlocked; please run again.',
        });
      }
      if (pendingSynth.current && now - synthStartedAt.current > 125000) {
        pendingSynth.current = null;
        synthStartedAt.current = 0;
        cancelledStaleWork = true;
        clearSynthWatchdog();
        setEstimating(false);
        setAreaError(
          locale === 'zh'
            ? '頁面閒置期間合成環境失去回應，已自動解除鎖定。'
            : 'The synthesis runtime stopped responding while the page was idle. The UI has been unlocked.',
        );
      }

      setEngineReady(false);
      if (cancelledStaleWork)
        iframeRef.current?.contentWindow?.postMessage(
          { type: 'SOC_RTL_CANCEL' },
          window.location.origin,
        );
      window.requestAnimationFrame(() => {
        iframeRef.current?.contentWindow?.postMessage(
          { type: 'SOC_RTL_ENGINE_PING' },
          window.location.origin,
        );
      });
    };

    recoverAfterSuspend();
    document.addEventListener('visibilitychange', recoverAfterSuspend);
    window.addEventListener('pageshow', recoverAfterSuspend);
    return () => {
      document.documentElement.classList.remove('page-hidden');
      document.removeEventListener('visibilitychange', recoverAfterSuspend);
      window.removeEventListener('pageshow', recoverAfterSuspend);
    };
  }, [clearRunWatchdog, clearSynthWatchdog, locale]);

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
      clearRunWatchdog();
      const next: Result = {
        ok: Boolean(event.data.ok),
        phase: event.data.phase,
        console: String(event.data.console || ''),
        elapsedMs: Number(event.data.elapsedMs || 0),
        checks: Array.isArray(event.data.checks)
          ? event.data.checks.slice(0, 32)
          : [],
        goldenMismatch:
          event.data.goldenMismatch &&
          typeof event.data.goldenMismatch === 'object'
            ? event.data.goldenMismatch
            : null,
      };
      runStartedAt.current = 0;
      setResult(next);
      setWaveforms({
        current: String(event.data.vcd || ''),
        golden: String(event.data.goldenVcd || ''),
      });
      setRunning(false);
      scheduleMascotReturn();
      if (next.ok) markSolved(current.id);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [clearRunWatchdog, current.id, markSolved, scheduleMascotReturn]);

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
      synthStartedAt.current = 0;
      clearSynthWatchdog();
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
        referenceCounts:
          event.data.referenceCounts &&
          typeof event.data.referenceCounts === 'object'
            ? event.data.referenceCounts
            : null,
        elapsedMs: Number(event.data.elapsedMs || 0),
      });
    };
    window.addEventListener('message', onSynthesis);
    return () => window.removeEventListener('message', onSynthesis);
  }, [clearSynthWatchdog, text.areaError]);

  useEffect(
    () => () => {
      clearRunWatchdog();
      clearSynthWatchdog();
    },
    [clearRunWatchdog, clearSynthWatchdog],
  );

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
    const hadActiveWork =
      pendingRequest.current !== null ||
      pendingSynth.current !== null ||
      instantJudgeTimer.current !== null;
    if (hadActiveWork) {
      pendingRequest.current = null;
      pendingSynth.current = null;
      runStartedAt.current = 0;
      synthStartedAt.current = 0;
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'SOC_RTL_CANCEL' },
        window.location.origin,
      );
      setRunning(false);
      setBattleVisible(false);
      setEstimating(false);
      clearRunWatchdog();
      clearSynthWatchdog();
      if (battleReturnTimer.current !== null) {
        window.clearTimeout(battleReturnTimer.current);
        battleReturnTimer.current = null;
      }
      if (instantJudgeTimer.current !== null) {
        window.clearTimeout(instantJudgeTimer.current);
        instantJudgeTimer.current = null;
      }
    }
    if (areaResult) setAreaResult(null);
    if (areaError) setAreaError('');
    if (dailyReviewActive) {
      setDailyReview((previous) =>
        previous ? { ...previous, draft: next } : previous,
      );
    } else {
      setSolutions((previous) => {
        return { ...previous, [current.id]: next };
      });
    }
    if (result) setResult(null);
    if (waveforms.current || waveforms.golden)
      setWaveforms({ current: '', golden: '' });
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
    setCoinReward(null);
    setResult(null);
    setWaveforms({ current: '', golden: '' });
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
    runStartedAt.current = Date.now();
    setRunning(true);
    clearRunWatchdog();
    runWatchdogTimer.current = window.setTimeout(() => {
      if (pendingRequest.current !== requestId) return;
      pendingRequest.current = null;
      runStartedAt.current = 0;
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'SOC_RTL_CANCEL' },
        window.location.origin,
      );
      if (iframeRef.current) iframeRef.current.src = './engine/runner.html';
      setRunning(false);
      setEngineReady(false);
      setResult({
        ok: false,
        phase: 'engine',
        console:
          locale === 'zh'
            ? '執行環境逾時，已自動解除鎖定並重新連線；請再執行一次。'
            : 'The runtime timed out. The UI was unlocked and is reconnecting; please run again.',
      });
      scheduleMascotReturn();
      runWatchdogTimer.current = null;
    }, 50000);
    iframeRef.current.contentWindow.postMessage(
      {
        type: 'SOC_RTL_RUN',
        requestId,
        design: code,
        reference: referenceCode,
        challengeId: current.id,
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
    setCoinReward(null);
    startBattle();
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
    scheduleMascotReturn();
  };

  const estimateArea = () => {
    if (!engineReady || !iframeRef.current?.contentWindow) return;
    const requestId = `synth-${Date.now()}`;
    pendingSynth.current = requestId;
    synthStartedAt.current = Date.now();
    setEstimating(true);
    setAreaError('');
    setAreaResult(null);
    clearSynthWatchdog();
    synthWatchdogTimer.current = window.setTimeout(() => {
      if (pendingSynth.current !== requestId) return;
      pendingSynth.current = null;
      synthStartedAt.current = 0;
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'SOC_RTL_CANCEL' },
        window.location.origin,
      );
      if (iframeRef.current) iframeRef.current.src = './engine/runner.html';
      setEstimating(false);
      setEngineReady(false);
      setAreaError(
        locale === 'zh'
          ? '合成逾時，已自動解除鎖定並重新連線；請稍後再試。'
          : 'Synthesis timed out. The UI was unlocked and is reconnecting; please retry.',
      );
      synthWatchdogTimer.current = null;
    }, 125000);
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
  const spentPoints =
    equipmentSpend + elementSpend + consumableSpend + enhancementSpend;
  const walletPoints = Math.max(
    0,
    points +
      hbmEarnedPoints -
      spentPoints +
      resaleCredits +
      dailyProgress.rewardCredits,
  );
  useEffect(() => {
    if (storageLoaded.current)
      browserStorage.setItem(storageKeys.sharedSocEarned, String(points));
  }, [points]);
  useEffect(() => {
    const syncHbmPoints = () => {
      const value = Number(
        browserStorage.getItem(storageKeys.sharedHbmEarned) ?? '0',
      );
      if (Number.isFinite(value) && value >= 0) setHbmEarnedPoints(value);
    };
    window.addEventListener('storage', syncHbmPoints);
    window.addEventListener('focus', syncHbmPoints);
    return () => {
      window.removeEventListener('storage', syncHbmPoints);
      window.removeEventListener('focus', syncHbmPoints);
    };
  }, []);
  const progress = Math.round((solved.length / challenges.length) * 100);
  const mascotStage = mascotStageFor(points);
  const activeMascotProfession =
    mascotProfession !== 'novice' &&
    !professionProgress[mascotProfession].unlocked
      ? 'novice'
      : mascotProfession;
  const equippedEquipment = equipmentInventory.find(
    (item) => item.uid === equippedEquipmentUid,
  );
  const activeEquipment =
    equippedEquipment &&
    (equipmentCatalog[equippedEquipment.id].profession === 'all' ||
      equipmentCatalog[equippedEquipment.id].profession ===
        activeMascotProfession)
      ? equippedEquipment.id
      : null;
  const activeEquipmentStars = activeEquipment
    ? (equippedEquipment?.stars ?? 0)
    : 0;
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
  const revealedHints = aidUnlocks.hints[current.id] ?? 0;
  const logicUnlocked = aidUnlocks.logic.includes(current.id);
  const goldenUnlocked = aidUnlocks.golden.includes(current.id);
  const checkedInToday =
    Boolean(todayKey) && dailyProgress.lastCheckIn === todayKey;
  const dailyQuestClaimed =
    Boolean(todayKey) &&
    dailyProgress.questDate === todayKey &&
    dailyProgress.questClaimed;
  const streakCycleDay =
    dailyProgress.streak === 0 ? 0 : ((dailyProgress.streak - 1) % 7) + 1;

  const claimDailyCheckIn = () => {
    if (!todayKey || checkedInToday) return;
    const currentOrdinal = dateOrdinal(todayKey);
    const previousOrdinal = dateOrdinal(dailyProgress.lastCheckIn);
    const nextStreak =
      Number.isFinite(previousOrdinal) && currentOrdinal - previousOrdinal === 1
        ? dailyProgress.streak + 1
        : 1;
    const milestone = nextStreak % 7 === 0;
    setDailyProgress((previous) => ({
      ...previous,
      lastCheckIn: todayKey,
      streak: nextStreak,
      rewardCredits: previous.rewardCredits + 50 + (milestone ? 150 : 0),
    }));
    if (milestone)
      setConsumables((previous) => ({
        ...previous,
        hammer: previous.hammer + 1,
      }));
  };

  const startDailyReview = () => {
    selectChallenge(dailyChallenge.id);
    setDailyReview({
      date: todayKey,
      challengeId: dailyChallenge.id,
      draft: formatCodeForEditor(
        dailyChallenge.starter,
        dailyChallenge.language,
      ),
    });
  };

  const buyEquipment = (id: EquipmentId) => {
    if (walletPoints < equipmentCatalog[id].cost) return;
    const instance = createEquipmentInstance(id);
    setEquipmentInventory((previous) => [...previous, instance]);
    setEquipmentSpend((previous) => previous + equipmentCatalog[id].cost);
    const profession = equipmentCatalog[id].profession;
    if (profession === 'all' || profession === activeMascotProfession) {
      setEquippedEquipmentUid(instance.uid);
    }
  };

  const sellEquipment = (uid: string) => {
    const instance = equipmentInventory.find((item) => item.uid === uid);
    if (!instance) return;
    setEquipmentInventory((previous) =>
      previous.filter((item) => item.uid !== uid),
    );
    if (equippedEquipmentUid === uid) setEquippedEquipmentUid(null);
    setResaleCredits(
      (previous) =>
        previous + Math.floor(equipmentCatalog[instance.id].cost / 2),
    );
    if (enhancementOutcome?.uid === uid) setEnhancementOutcome(null);
  };

  const enhanceEquipment = (uid: string) => {
    const instance = equipmentInventory.find((item) => item.uid === uid);
    if (!instance) return;
    const before = instance.stars;
    if (before >= 5) return;
    if (consumables.hammer < 1) return;
    const success = rollEquipmentUpgrade(before);
    const after = success ? before + 1 : before >= 2 ? before - 1 : before;
    setConsumables((previous) => ({
      ...previous,
      hammer: Math.max(0, previous.hammer - 1),
    }));
    setEquipmentInventory((previous) =>
      previous.map((item) =>
        item.uid === uid ? { ...item, stars: after } : item,
      ),
    );
    setEnhancementOutcome({ uid, id: instance.id, success, before, after });
  };

  const forgeEquipmentDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setForgeDragActive(false);
    const uid = event.dataTransfer.getData('application/x-equipment-uid');
    if (uid) enhanceEquipment(uid);
  };

  const buyConsumable = (id: ConsumableId) => {
    const cost = consumableCatalog[id].cost;
    if (walletPoints < cost) return;
    setConsumableSpend((previous) => previous + cost);
    setConsumables((previous) => ({
      ...previous,
      [id]: previous[id] + 1,
    }));
  };

  const unlockLogicAid = () => {
    if (logicUnlocked || consumables.crystal < 1) return;
    setConsumables((previous) => ({
      ...previous,
      crystal: previous.crystal - 1,
    }));
    setAidUnlocks((previous) => ({
      ...previous,
      logic: [...new Set([...previous.logic, current.id])],
    }));
  };

  const unlockGoldenAid = () => {
    if (goldenUnlocked || consumables.visor < 1) return;
    setConsumables((previous) => ({
      ...previous,
      visor: previous.visor - 1,
    }));
    setAidUnlocks((previous) => ({
      ...previous,
      golden: [...new Set([...previous.golden, current.id])],
    }));
  };

  const unlockNextHint = () => {
    if (revealedHints >= 3 || consumables.drone < 1) return;
    setConsumables((previous) => ({
      ...previous,
      drone: previous.drone - 1,
    }));
    setAidUnlocks((previous) => ({
      ...previous,
      hints: {
        ...previous.hints,
        [current.id]: Math.min(3, (previous.hints[current.id] ?? 0) + 1),
      },
    }));
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
    setMascotIsTapping(true);
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
        onLoad={() => {
          setEngineReady(false);
          if (pendingRequest.current !== null) {
            pendingRequest.current = null;
            clearRunWatchdog();
            setRunning(false);
            setResult({
              ok: false,
              phase: 'engine',
              console:
                locale === 'zh'
                  ? '執行環境已重新啟動，請再執行一次。'
                  : 'The runtime restarted. Please run the test again.',
            });
            scheduleMascotReturn();
          }
          if (pendingSynth.current !== null) {
            pendingSynth.current = null;
            clearSynthWatchdog();
            setEstimating(false);
            setAreaError(
              locale === 'zh'
                ? '合成環境已重新啟動，請稍後再試。'
                : 'The synthesis runtime restarted. Please retry.',
            );
          }
          window.requestAnimationFrame(() => {
            iframeRef.current?.contentWindow?.postMessage(
              { type: 'SOC_RTL_ENGINE_PING' },
              window.location.origin,
            );
          });
        }}
      />
      <header className="relative z-30 border-b border-border bg-card">
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

      <div className="lab-shell mx-auto grid max-w-[1580px] xl:grid-cols-[290px_minmax(0,1fr)_330px]">
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
            <section
              className="daily-training-card mt-3"
              aria-label={text.dailyTraining}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold">
                  <Gift className="size-3.5 text-amber-500" />
                  {text.dailyTraining}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {text.streak} {dailyProgress.streak} ({streakCycleDay}/7)
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="mt-2 w-full justify-center"
                disabled={!todayKey || checkedInToday}
                onClick={claimDailyCheckIn}
              >
                <Coins />
                {checkedInToday ? text.checkedIn : text.dailyCheckIn}
              </Button>
              <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
                {text.streakReward}
              </p>
              <div className="mt-2 border-t border-sidebar-border pt-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                  {text.dailyQuest}
                </p>
                <p className="mt-1 line-clamp-2 text-xs font-medium leading-4">
                  {localize(dailyChallenge.title, locale)}
                </p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-muted-foreground">
                    {dailyQuestClaimed
                      ? text.dailyQuestDone
                      : text.dailyQuestReward}
                  </span>
                  <button
                    type="button"
                    onClick={startDailyReview}
                    disabled={!todayKey}
                    className="text-[10px] font-semibold text-primary hover:underline disabled:opacity-50"
                  >
                    {text.goDailyQuest}
                  </button>
                </div>
              </div>
            </section>
            <div className="mt-3 overflow-hidden rounded-xl border border-sidebar-border bg-sidebar-accent">
              <div className="grid grid-cols-[70px_minmax(0,1fr)] items-center gap-3 p-2.5">
                <MascotAvatar
                  gender={mascotGender}
                  profession={activeMascotProfession}
                  tier={mascotStage}
                  equipment={activeEquipment}
                  equipmentStarLevel={activeEquipmentStars}
                  elements={elementLevels}
                  equippedElement={equippedElement}
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
                      <div
                        className="grid grid-cols-2 rounded-xl bg-muted p-1"
                        role="tablist"
                        aria-label={text.mascotCustomize}
                      >
                        <button
                          type="button"
                          role="tab"
                          aria-selected={mascotPanel === 'backpack'}
                          onClick={() => setMascotPanel('backpack')}
                          className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${mascotPanel === 'backpack' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                          {text.backpack}
                        </button>
                        <button
                          type="button"
                          role="tab"
                          aria-selected={mascotPanel === 'shop'}
                          onClick={() => setMascotPanel('shop')}
                          className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${mascotPanel === 'shop' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                          {text.shop}
                        </button>
                      </div>

                      {mascotPanel === 'backpack' ? (
                        <div className="space-y-4">
                          <div>
                            <p className="mb-2 text-sm font-semibold">
                              {text.mascotGender}
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                              {(
                                ['masculine', 'feminine'] as MascotGender[]
                              ).map((gender) => (
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
                              ))}
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
                            <p className="mb-1 text-sm font-semibold">
                              {text.learningTools}
                            </p>
                            <p className="mb-3 text-xs leading-5 text-muted-foreground">
                              {text.starterTools}
                            </p>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                              {(
                                Object.keys(consumableCatalog) as ConsumableId[]
                              ).map((id) => {
                                const item = consumableCatalog[id];
                                return (
                                  <div
                                    key={id}
                                    className="rounded-xl border border-border bg-muted/25 p-2 text-center"
                                  >
                                    <div className="equipment-shop-icon mx-auto">
                                      {item.artwork ? (
                                        <EquipmentArtwork
                                          src={item.artwork.src}
                                        />
                                      ) : (
                                        <EquipmentIcon
                                          id={item.icon}
                                          className="equipment-shop-main-icon"
                                        />
                                      )}
                                    </div>
                                    <span className="mt-1 block text-[11px] font-semibold leading-4">
                                      {item.name[locale]}
                                    </span>
                                    <span className="mt-1 block font-mono text-xs font-bold text-primary">
                                      × {consumables[id]}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                            <p className="mt-3 rounded-lg bg-violet-500/10 px-3 py-2 text-xs leading-5 text-violet-800 dark:text-violet-200">
                              <strong>{text.bossDrop}：</strong>{' '}
                              {text.bossDropBody}
                            </p>
                          </div>

                          <div className="border-t border-border pt-4">
                            <p className="mb-2 text-sm font-semibold">
                              {text.equipment}
                            </p>
                            <p className="mb-3 rounded-lg border border-amber-300/60 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-900 dark:text-amber-100">
                              {text.forgeNotice}
                            </p>
                            <div
                              className={`forge-station mb-3 ${forgeDragActive ? 'is-drag-active' : ''}`}
                              onDragEnter={(event) => {
                                event.preventDefault();
                                setForgeDragActive(true);
                              }}
                              onDragOver={(event) => event.preventDefault()}
                              onDragLeave={(event) => {
                                if (
                                  !event.currentTarget.contains(
                                    event.relatedTarget as Node,
                                  )
                                )
                                  setForgeDragActive(false);
                              }}
                              onDrop={forgeEquipmentDrop}
                            >
                              <span className="forge-hammer-icon">
                                <Hammer aria-hidden="true" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <strong className="block text-sm">
                                  {text.forgeStation}
                                </strong>
                                <span className="block text-xs text-muted-foreground">
                                  {text.forgeDrag}
                                </span>
                              </span>
                              <span className="rounded-full bg-card px-2 py-1 font-mono text-xs font-semibold">
                                {text.forgeHammerCount} × {consumables.hammer}
                              </span>
                            </div>
                            {enhancementOutcome && (
                              <output
                                className={`mb-3 block rounded-lg px-3 py-2 text-xs font-semibold ${enhancementOutcome.success ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-200' : 'bg-rose-500/10 text-rose-800 dark:text-rose-200'}`}
                              >
                                {
                                  equipmentCatalog[enhancementOutcome.id].name[
                                    locale
                                  ]
                                }
                                ：{' '}
                                {enhancementOutcome.success
                                  ? `${text.forgeSuccess} · ${enhancementOutcome.after}★`
                                  : enhancementOutcome.after <
                                      enhancementOutcome.before
                                    ? `${text.forgeDowngrade} · ${enhancementOutcome.after}★`
                                    : text.forgeProtected}
                              </output>
                            )}
                            {equipmentInventory.length === 0 ? (
                              <p className="rounded-lg bg-muted/50 px-3 py-4 text-center text-xs text-muted-foreground">
                                {text.noOwnedEquipment}
                              </p>
                            ) : (
                              <div className="grid gap-2 sm:grid-cols-3">
                                {equipmentInventory.map((instance, index) => {
                                  const { id, uid, stars } = instance;
                                  const item = equipmentCatalog[id];
                                  const equipped =
                                    equippedEquipmentUid === uid &&
                                    activeEquipment === id;
                                  const classUnavailable =
                                    item.profession !== 'all' &&
                                    item.profession !== activeMascotProfession;
                                  const copyNumber = equipmentInventory
                                    .slice(0, index + 1)
                                    .filter((owned) => owned.id === id).length;
                                  const copyTotal = equipmentInventory.filter(
                                    (owned) => owned.id === id,
                                  ).length;
                                  const forgeRate = Math.round(
                                    equipmentUpgradeRate(stars) * 100,
                                  );
                                  return (
                                    <div
                                      key={uid}
                                      draggable
                                      onDragStart={(event) => {
                                        event.dataTransfer.effectAllowed =
                                          'move';
                                        event.dataTransfer.setData(
                                          'application/x-equipment-uid',
                                          uid,
                                        );
                                      }}
                                      onDragEnd={() =>
                                        setForgeDragActive(false)
                                      }
                                      className={`rounded-xl border p-3 text-center transition-colors ${equipped ? 'border-primary bg-primary/10' : 'border-border'}`}
                                    >
                                      <div
                                        className={`equipment-shop-icon equipment-${item.profession}`}
                                      >
                                        {item.artwork ? (
                                          <EquipmentArtwork
                                            src={item.artwork.src}
                                          />
                                        ) : (
                                          <EquipmentIcon
                                            id={item.icon}
                                            className="equipment-shop-main-icon"
                                          />
                                        )}
                                      </div>
                                      <span className="mt-2 block text-xs font-semibold">
                                        {item.name[locale]}
                                      </span>
                                      {copyTotal > 1 && (
                                        <span className="mt-0.5 block text-[11px] font-medium text-muted-foreground">
                                          {locale === 'zh'
                                            ? `第 ${copyNumber} 件`
                                            : `Copy ${copyNumber}`}
                                        </span>
                                      )}
                                      <EquipmentStarRow stars={stars} />
                                      <span className="mt-1 block text-[11px] text-muted-foreground">
                                        {stars >= 5
                                          ? text.divineGear
                                          : `${text.forgeChance} ${forgeRate}%`}
                                      </span>
                                      <div className="mt-2 grid grid-cols-2 gap-1.5">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="col-span-2"
                                          disabled={classUnavailable}
                                          title={
                                            classUnavailable
                                              ? text.professionRequired
                                              : undefined
                                          }
                                          onClick={() =>
                                            setEquippedEquipmentUid(
                                              equipped ? null : uid,
                                            )
                                          }
                                        >
                                          {equipped ? text.unequip : text.equip}
                                        </Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          disabled={
                                            stars >= 5 || consumables.hammer < 1
                                          }
                                          title={
                                            consumables.hammer < 1
                                              ? text.forgeNeedsHammer
                                              : undefined
                                          }
                                          onClick={() => enhanceEquipment(uid)}
                                        >
                                          <Star />{' '}
                                          {stars >= 5
                                            ? text.maxStars
                                            : text.forge}
                                        </Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => sellEquipment(uid)}
                                        >
                                          <Coins /> {text.sell}
                                        </Button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          <div className="border-t border-border pt-4">
                            <p className="text-sm font-semibold">
                              {text.activeElement}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                              {text.enchantmentBody}
                            </p>
                            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                              <button
                                type="button"
                                aria-pressed={equippedElement === null}
                                onClick={() => setEquippedElement(null)}
                                className={`rounded-lg border px-3 py-2 text-xs font-semibold ${equippedElement === null ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted'}`}
                              >
                                {text.noElement}
                              </button>
                              {(Object.keys(elementCatalog) as ElementId[])
                                .filter((element) => elementLevels[element] > 0)
                                .map((element) => {
                                  const item = elementCatalog[element];
                                  return (
                                    <button
                                      key={element}
                                      type="button"
                                      aria-pressed={equippedElement === element}
                                      onClick={() =>
                                        setEquippedElement(element)
                                      }
                                      className={`element-loadout-button ${item.className} ${equippedElement === element ? 'is-equipped' : ''}`}
                                    >
                                      <span className="element-loadout-dot" />
                                      {item.name[locale]} · Lv.
                                      {elementLevels[element]}
                                    </button>
                                  );
                                })}
                              {Object.values(elementLevels).every(
                                (level) => level > 0,
                              ) && (
                                <button
                                  type="button"
                                  aria-pressed={
                                    equippedElement === 'four-roots'
                                  }
                                  onClick={() =>
                                    setEquippedElement('four-roots')
                                  }
                                  className={`four-roots-loadout-button ${equippedElement === 'four-roots' ? 'is-equipped' : ''}`}
                                >
                                  <Sparkles className="size-4" />{' '}
                                  {text.fourRootsEquip}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2">
                            <p className="text-sm font-semibold">
                              {text.mascotShop}
                            </p>
                            <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 font-mono text-xs font-semibold text-amber-800">
                              <Coins className="size-3.5" />
                              {walletPoints} {text.points}
                            </span>
                          </div>

                          <div>
                            <p className="mb-1 text-sm font-semibold">
                              {text.learningTools}
                            </p>
                            <p className="mb-3 text-xs leading-5 text-muted-foreground">
                              {text.starterTools}
                            </p>
                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                              {(
                                Object.keys(consumableCatalog) as ConsumableId[]
                              ).map((id) => {
                                const item = consumableCatalog[id];
                                return (
                                  <div
                                    key={id}
                                    className="rounded-xl border border-border p-3"
                                  >
                                    <div className="equipment-shop-icon mx-auto">
                                      {item.artwork ? (
                                        <EquipmentArtwork
                                          src={item.artwork.src}
                                        />
                                      ) : (
                                        <EquipmentIcon
                                          id={item.icon}
                                          className="equipment-shop-main-icon"
                                        />
                                      )}
                                    </div>
                                    <p className="mt-2 text-center text-sm font-semibold">
                                      {item.name[locale]}
                                    </p>
                                    <p className="mt-1 min-h-10 text-center text-xs leading-5 text-muted-foreground">
                                      {item.effect[locale]}
                                    </p>
                                    <p className="mt-1 text-center font-mono text-xs text-primary">
                                      {text.quantity} × {consumables[id]}
                                    </p>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="mt-2 w-full"
                                      disabled={walletPoints < item.cost}
                                      onClick={() => buyConsumable(id)}
                                    >
                                      <Coins /> {text.buy} · {item.cost}
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          <div>
                            <p className="mb-2 text-sm font-semibold">
                              {text.shopEquipment}
                            </p>
                            <div className="grid gap-2 sm:grid-cols-3">
                              {(
                                Object.keys(equipmentCatalog) as EquipmentId[]
                              ).map((id) => {
                                const item = equipmentCatalog[id];
                                const ownedCount = equipmentInventory.filter(
                                  (owned) => owned.id === id,
                                ).length;
                                return (
                                  <div
                                    key={id}
                                    className="rounded-xl border border-border p-3"
                                  >
                                    <div
                                      className={`equipment-shop-icon equipment-${item.profession}`}
                                    >
                                      {item.artwork ? (
                                        <EquipmentArtwork
                                          src={item.artwork.src}
                                        />
                                      ) : (
                                        <EquipmentIcon
                                          id={item.icon}
                                          className="equipment-shop-main-icon"
                                        />
                                      )}
                                    </div>
                                    <p className="mt-2 text-center text-sm font-semibold">
                                      {item.name[locale]}
                                    </p>
                                    <p className="mt-1 min-h-10 text-center text-xs leading-5 text-muted-foreground">
                                      {item.effect[locale]}
                                    </p>
                                    <p className="mt-1 text-center text-[11px] font-medium text-muted-foreground">
                                      {locale === 'zh'
                                        ? `持有 × ${ownedCount}`
                                        : `Owned × ${ownedCount}`}
                                    </p>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="mt-2 w-full"
                                      disabled={walletPoints < item.cost}
                                      onClick={() => buyEquipment(id)}
                                    >
                                      <Coins /> {text.buy} · {item.cost}
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          <div className="border-t border-border pt-4">
                            <p className="text-sm font-semibold">
                              {text.enchantments}
                            </p>
                            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                              {(Object.keys(elementCatalog) as ElementId[]).map(
                                (element) => {
                                  const item = elementCatalog[element];
                                  const level = elementLevels[element];
                                  const cost = elementUpgradeCost(level);
                                  const Icon =
                                    element === 'fire'
                                      ? Flame
                                      : element === 'water'
                                        ? Waves
                                        : element === 'wind'
                                          ? Wind
                                          : Shield;
                                  return (
                                    <div
                                      key={element}
                                      className={`element-stone-card ${item.className}`}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="element-stone-icon">
                                          <Icon className="size-6" />
                                        </span>
                                        <span className="font-mono text-xs font-semibold">
                                          {text.level} {level}
                                        </span>
                                      </div>
                                      <p className="mt-3 text-sm font-semibold">
                                        {item.name[locale]}
                                      </p>
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
                                },
                              )}
                            </div>
                          </div>

                          <div className="rounded-xl border border-dashed border-border bg-muted/35 p-4">
                            <div className="flex items-start gap-3">
                              <Gift className="mt-0.5 size-5 shrink-0 text-primary" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold">
                                  {text.support}
                                </p>
                                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                  {text.supportBody}
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    nativeButton={false}
                                    render={
                                      <a
                                        href={supportConfig.paypalUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        aria-label={text.paypalAction}
                                      />
                                    }
                                  >
                                    <ExternalLink /> {text.paypalAction}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    nativeButton={false}
                                    render={
                                      <a
                                        href="https://xizhuwang.github.io/"
                                        target="_blank"
                                        rel="noreferrer"
                                        aria-label={text.contactSupport}
                                      />
                                    }
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
                        </div>
                      )}
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

        <section className="lab-content min-w-0 px-4 py-6 sm:px-7">
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
              {dailyReviewActive && (
                <div className="mt-3 rounded-lg border border-violet-300/60 bg-violet-500/10 px-3 py-2 text-xs leading-5 text-violet-900 dark:text-violet-100">
                  <strong>{text.dailyReviewMode}：</strong>{' '}
                  {text.dailyReviewModeBody}
                </div>
              )}
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
            {socLearningAid && !dailyReviewNoAids && (
              <SocInterfaceGuide aid={socLearningAid} locale={locale} />
            )}
            {!dailyReviewNoAids && !logicUnlocked && (
              <AidUnlockCard
                id="crystal"
                count={consumables.crystal}
                locale={locale}
                onUnlock={unlockLogicAid}
              />
            )}
            {current.id === 'soc-stream-register-slice' &&
              logicUnlocked &&
              !dailyReviewNoAids && (
                <section
                  className="elastic-buffer-guide mt-4"
                  aria-label={
                    locale === 'zh'
                      ? '一格彈性緩衝邏輯'
                      : 'One-entry elastic buffer logic'
                  }
                >
                  <div className="elastic-buffer-flow" aria-hidden="true">
                    <span>
                      {locale === 'zh' ? '上游' : 'Source'}
                      <code>s_valid / s_data</code>
                    </span>
                    <ArrowRight className="size-4" />
                    <span>
                      {locale === 'zh' ? '一格座位' : '1-entry seat'}
                      <code>m_valid / m_data</code>
                    </span>
                    <ArrowRight className="size-4" />
                    <span>
                      {locale === 'zh' ? '下游' : 'Sink'}
                      <code>m_ready</code>
                    </span>
                  </div>
                  <div className="elastic-buffer-rules">
                    <code>push = s_valid &amp;&amp; s_ready</code>
                    <code>pop = m_valid &amp;&amp; m_ready</code>
                    <code>s_ready = !m_valid || m_ready</code>
                  </div>
                  <p>
                    {locale === 'zh'
                      ? 'm_valid=0 是 EMPTY；push 後變 FULL。FULL 只 pop 會回 EMPTY；pop 與 push 同拍發生則仍為 FULL，舊資料直接換成新資料。下游卡住時 s_ready=0，m_valid 與 m_data 必須保持不變。'
                      : 'm_valid=0 means EMPTY; a push makes it FULL. A pop without a push returns to EMPTY. A simultaneous pop and push stays FULL and replaces the old word. While the sink stalls, s_ready=0 and both m_valid and m_data must remain stable.'}
                  </p>
                </section>
              )}
            {current.id !== 'soc-stream-register-slice' &&
              logicUnlocked &&
              !dailyReviewNoAids && (
                <LogicBriefCard challenge={current} locale={locale} />
              )}
            {goldenPattern && !goldenUnlocked && !dailyReviewNoAids && (
              <AidUnlockCard
                id="visor"
                count={consumables.visor}
                locale={locale}
                onUnlock={unlockGoldenAid}
              />
            )}
            {goldenPattern && goldenUnlocked && !dailyReviewNoAids && (
              <section
                className="golden-pattern mt-4 border-t border-border pt-4"
                aria-labelledby="golden-pattern-title"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p
                      id="golden-pattern-title"
                      className="flex items-center gap-2 text-sm font-semibold text-foreground"
                    >
                      <Waves className="size-4 text-cyan-500" />
                      {text.goldenPattern}
                    </p>
                    <p className="mt-1 text-sm font-medium text-cyan-800 dark:text-cyan-200">
                      {localize(goldenPattern.title, locale)}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-cyan-300 text-cyan-700 dark:border-cyan-800 dark:text-cyan-200"
                  >
                    {locale === 'zh' ? '行為範例' : 'Behavior example'}
                  </Badge>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {localize(goldenPattern.summary, locale)}
                </p>
                <details className="golden-pattern-details mt-3">
                  <summary>
                    {locale === 'zh'
                      ? '展開逐拍 Golden 範例'
                      : 'Open cycle-by-cycle Golden example'}
                  </summary>
                  <div className="golden-pattern-table mt-3 overflow-x-auto rounded-lg border border-cyan-200/80 dark:border-cyan-900">
                    <table>
                      <thead>
                        <tr>
                          {goldenPattern.columns.map((column, index) => (
                            <th key={index} scope="col">
                              {localize(column, locale)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {goldenPattern.rows.map((row, rowIndex) => (
                          <tr key={rowIndex}>
                            {row.map((cell, cellIndex) => (
                              <td
                                key={cellIndex}
                                className={
                                  cellIndex === 0
                                    ? 'golden-event-cell'
                                    : undefined
                                }
                              >
                                {typeof cell === 'string'
                                  ? cell
                                  : localize(cell, locale)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
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
            <div
              className={`mascot-companion-stage mt-4 grid grid-cols-[84px_minmax(0,1fr)] items-end gap-3 border-t border-border pt-4 sm:grid-cols-[104px_minmax(0,1fr)] ${battleVisible ? 'battle-stage-active' : ''}`}
            >
              <button
                type="button"
                onClick={interactWithMascot}
                onAnimationEnd={() => setMascotIsTapping(false)}
                aria-label={text.mascotInteract}
                className={`mascot-hint-button ${mascotIsTapping ? 'mascot-tapped' : ''} ${battleVisible ? 'mascot-departed' : ''}`}
              >
                <MascotAvatar
                  gender={mascotGender}
                  profession={activeMascotProfession}
                  tier={mascotStage}
                  equipment={activeEquipment}
                  equipmentStarLevel={activeEquipmentStars}
                  elements={elementLevels}
                  equippedElement={equippedElement}
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
                      <span>
                        <b>{text.whyTitle}</b> {localize(context.why, locale)}
                      </span>
                      <span>
                        <b>{text.rolesTitle}</b>{' '}
                        {localize(context.roles, locale)}
                      </span>
                    </span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {!dailyReviewNoAids && (
                    <button
                      type="button"
                      onClick={unlockNextHint}
                      disabled={revealedHints >= 3 || consumables.drone < 1}
                      className="flex items-center gap-2 text-sm font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Lightbulb className="size-4" />
                      {revealedHints >= 3
                        ? text.unlockedAid
                        : `${consumableCatalog.drone.name[locale]} × ${consumables.drone}`}
                      <ChevronDown
                        className={`size-4 transition-transform ${revealedHints > 0 ? 'rotate-180' : ''}`}
                      />
                    </button>
                  )}
                  {current.judge !== 'interactive' && (
                    <Button
                      size="sm"
                      onClick={run}
                      disabled={
                        running ||
                        (current.judge === 'simulation' && !engineReady)
                      }
                      className="mascot-run-button ml-auto"
                    >
                      {running ? (
                        <LoaderCircle className="animate-spin" />
                      ) : (
                        <Swords />
                      )}
                      {running ? text.running : text.run}
                    </Button>
                  )}
                  {current.difficulty === 'advanced' && (
                    <Badge
                      className="border-red-300 bg-red-500/10 text-red-700 dark:border-red-900 dark:text-red-200"
                      variant="outline"
                    >
                      BOSS
                    </Badge>
                  )}
                </div>
                {revealedHints > 0 && !dailyReviewNoAids && (
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
                  locale={locale}
                  gender={mascotGender}
                  profession={activeMascotProfession}
                  tier={mascotStage}
                  equipment={activeEquipment}
                  equipmentStarLevel={activeEquipmentStars}
                  elements={elementLevels}
                  equippedElement={equippedElement}
                  status={battleStatus}
                  enemy={enemyForChallenge(
                    current.id,
                    current.difficulty,
                    current.order,
                  )}
                  coinReward={coinReward}
                  dropReward={dropReward}
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
          {(waveforms.current || waveforms.golden) && (
            <WaveformViewer
              currentVcd={waveforms.current}
              goldenVcd={waveforms.golden}
              design={code}
              locale={locale}
            />
          )}
          <details className="ppa-panel mt-6 rounded-xl border border-border bg-muted/30">
            <summary className="flex cursor-pointer items-center gap-3 p-4 text-sm font-semibold">
              <Gauge className="size-5 shrink-0 text-primary" />
              {text.ppaTitle}
            </summary>
            <div className="px-4 pb-4">
              <div className="min-w-0">
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
                    {areaResult.referenceCounts ? (
                      <CellComparisonTable
                        currentCounts={areaResult.counts}
                        referenceCounts={areaResult.referenceCounts}
                        locale={locale}
                      />
                    ) : (
                      <p className="mt-2 break-words border-t border-border pt-2 font-mono text-[11px] leading-5 text-muted-foreground">
                        {Object.entries(areaResult.counts)
                          .sort((a, b) => b[1] - a[1])
                          .slice(0, 8)
                          .map(([name, count]) => `${name}: ${count}`)
                          .join(' · ')}
                      </p>
                    )}
                    {areaResult.referenceTotal !== null && (
                      <div className="mt-2 space-y-1 text-xs leading-5 text-muted-foreground">
                        <p>
                          {locale === 'zh'
                            ? '差異＝你的 RTL－參考解；負值只表示這次 generic synthesis 使用較少 cells。'
                            : 'Delta = your RTL − reference. A negative value only means fewer cells in this generic synthesis run.'}
                        </p>
                        <p>
                          {locale === 'zh'
                            ? '基準與你的 RTL 使用同一次、同版本、同參數的 Yosys generic synthesis；數字只能做相對比較，越少不一定代表實際 PPA 一定更好。'
                            : 'The reference and your RTL use the same Yosys version and generic synthesis settings. This is only a relative comparison; fewer cells do not guarantee better physical PPA.'}
                        </p>
                      </div>
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
          </details>
        </section>

        <aside className="lab-results border-t border-border bg-card px-4 py-6 sm:px-6 xl:min-h-[calc(100vh-65px)] xl:border-l xl:border-t-0">
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
          {result?.goldenMismatch && (
            <div className="mt-3 rounded-xl border border-destructive/35 bg-destructive/8 p-3 text-sm">
              <p className="font-semibold text-destructive">
                {locale === 'zh'
                  ? `第一個 Golden 波形差異：${result.goldenMismatch.signal}`
                  : `First Golden waveform mismatch: ${result.goldenMismatch.signal}`}
              </p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {locale === 'zh' ? 'VCD 時間刻度' : 'VCD time tick'}{' '}
                {result.goldenMismatch.time}
                {' · '}Golden {result.goldenMismatch.expected}
                {' · '}
                {locale === 'zh' ? '你的輸出' : 'Your output'}{' '}
                {result.goldenMismatch.actual}
              </p>
            </div>
          )}
          {result?.console && (
            <pre className="mt-3 max-h-[290px] overflow-auto whitespace-pre-wrap rounded-lg bg-editor p-3 font-mono text-[11px] leading-5 text-editor-foreground">
              {result.console
                .replaceAll('@@PASS@@', '')
                .replaceAll('@@FAIL@@', '')
                .trim()}
            </pre>
          )}
          {result?.checks?.length ? (
            <SimulationCheckTable checks={result.checks} locale={locale} />
          ) : null}
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
      <AdSenseUnit locale={locale} />
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
              ? '本站沒有登入、追蹤分析程式或接收解題程式碼的後端。若啟用頁尾廣告，廣告由 Google 提供，可能依其政策處理裝置、IP、Cookie 或廣告互動資料；廣告不會讀取編輯器內容，也不會影響判題、提示或獎勵。程式與進度存於此瀏覽器的 localStorage；同一 GitHub Pages 網域的其他頁面也可能存取這份儲存空間，請勿輸入公司 RTL、NDA 內容、密碼或個資。可透過瀏覽器網站資料設定清除本機紀錄。'
              : 'There are no accounts, analytics trackers or source-code submission backend. When the footer ad is enabled, Google serves it and may process device, IP, cookie or ad-interaction data under its policies. Ads cannot read editor contents and never affect judging, hints or rewards. Code and progress use browser localStorage, shared with other pages on this GitHub Pages origin. Do not enter company RTL, NDA material, passwords or personal data. Clear browser site data to remove local records.'}
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
            <a
              className="underline"
              href="https://www.paypal.com/tw/legalhub/privacy-full"
              target="_blank"
              rel="noreferrer"
            >
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
            {' · '}
            <a
              className="underline"
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noreferrer"
            >
              Google privacy
            </a>
          </p>
        </details>
      </footer>
    </main>
  );
}
