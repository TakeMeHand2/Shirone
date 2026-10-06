/**
 * 归档热力图取数：按年份分段的文章发布日历网格（GitHub 贡献图口径）。
 * 有文章的年份各生成一条整年周列（周一起始，头部/尾部以 null 对齐补位），
 * 供 ArchiveHeatmap 自上而下（新年份在前）渲染；构建期纯计算、SSR 直出，
 * 无运行时数据面；文章日聚合复用 getCalendarData()（与侧栏日历同一份缓存）。
 * 日期口径与文章卡片一致（formatDateToYYYYMMDD，UTC 字段直取）。
 */
import { getCalendarData } from "./calendar-data";
import { formatDateToYYYYMMDD } from "./date-utils";

export type HeatmapLevel = 0 | 1 | 2 | 3 | 4;

export interface HeatmapCell {
	/** YYYY-MM-DD */
	date: string;
	count: number;
	level: HeatmapLevel;
}

export interface HeatmapMonthLabel {
	/** YYYY-MM，ISO 形式（日期不进语言文件） */
	label: string;
	/** 所属周列下标 */
	column: number;
}

export interface HeatmapYear {
	year: number;
	/** 周列（列内恒 7 格；首尾按周一对齐补 null 占位） */
	weeks: (HeatmapCell | null)[][];
	monthLabels: HeatmapMonthLabel[];
	total: number;
	/** 当年有文章的天数 */
	activeDays: number;
	/** 当年单日峰值 */
	peakCount: number;
}

export interface ArchiveHeatmapData {
	/** 有文章的年份，降序（新年份在前） */
	years: HeatmapYear[];
	total: number;
	activeDays: number;
}

const DAY_MS = 86_400_000;
/** 档位阈值（固定阈值保证跨构建视觉稳定）：1 / 2 / 3-4 / 5+ */
const LEVEL_THRESHOLDS: readonly number[] = [1, 2, 3, 5];

function toUtcDayStart(date: Date): number {
	return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function resolveLevel(count: number): HeatmapLevel {
	let level: HeatmapLevel = 0;
	for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
		if (count >= LEVEL_THRESHOLDS[i]) level = (i + 1) as HeatmapLevel;
	}
	return level;
}

/** 周一为一周起点（0 = 周一 … 6 = 周日） */
function mondayIndex(utcDay: number): number {
	return (utcDay + 6) % 7;
}

let cache: ArchiveHeatmapData | null = null;

export async function getArchiveHeatmapData(): Promise<ArchiveHeatmapData> {
	if (cache) return cache;

	const { postsByDate } = await getCalendarData();
	const counts: Record<string, number> = {};
	const yearOf: Record<string, number> = {};
	for (const [date, items] of Object.entries(postsByDate)) {
		counts[date] = items.length;
		yearOf[date] = Number(date.slice(0, 4));
	}

	const yearsWithPosts = Array.from(new Set(Object.values(yearOf))).sort(
		(a, b) => b - a,
	);

	const years: HeatmapYear[] = yearsWithPosts.map((year) => {
		const jan1 = toUtcDayStart(new Date(Date.UTC(year, 0, 1)));
		const dec31 = toUtcDayStart(new Date(Date.UTC(year, 11, 31)));
		const headPadding = mondayIndex(new Date(jan1).getUTCDay());
		const totalDays = (dec31 - jan1) / DAY_MS + 1;
		const weekCount = Math.ceil((headPadding + totalDays) / 7);

		const weeks: (HeatmapCell | null)[][] = [];
		const monthLabelSeen = new Set<string>();
		const monthLabels: HeatmapMonthLabel[] = [];
		let yearTotal = 0;
		let activeDays = 0;
		let peakCount = 0;

		for (let week = 0; week < weekCount; week++) {
			const column: (HeatmapCell | null)[] = [];
			for (let day = 0; day < 7; day++) {
				const offset = week * 7 + day - headPadding;
				if (offset < 0 || offset > totalDays - 1) {
					column.push(null);
					continue;
				}
				const date = formatDateToYYYYMMDD(new Date(jan1 + offset * DAY_MS));
				const count = counts[date] ?? 0;
				column.push({ date, count, level: resolveLevel(count) });
				yearTotal += count;
				if (count > 0) {
					activeDays += 1;
					peakCount = Math.max(peakCount, count);
				}
			}
			// 月份标签：取每周列首格所属月，同月只标一次
			const firstCell = column.find(
				(cell): cell is HeatmapCell => cell !== null,
			);
			if (firstCell) {
				const monthKey = firstCell.date.slice(0, 7);
				if (!monthLabelSeen.has(monthKey)) {
					monthLabelSeen.add(monthKey);
					monthLabels.push({ label: monthKey, column: weeks.length });
				}
			}
			weeks.push(column);
		}

		return {
			year,
			weeks,
			monthLabels,
			total: yearTotal,
			activeDays,
			peakCount,
		};
	});

	cache = {
		years,
		total: years.reduce((sum, year) => sum + year.total, 0),
		activeDays: years.reduce((sum, year) => sum + year.activeDays, 0),
	};
	return cache;
}
