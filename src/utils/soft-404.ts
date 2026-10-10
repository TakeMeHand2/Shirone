import { url } from "./url-utils";

/**
 * 功能被配置关闭时，对应页面「不应该存在」——但静态输出做不到。
 *
 * 静态构建下页面文件已经写进产物，托管平台只会回 200；`Astro.redirect("/404/")`
 * 生成的同样是一份 **200 + meta-refresh** 的文档，而且**不带 noindex**，
 * 搜索引擎会把它当成正常页面收录（Search Console 里的软 404）。
 *
 * 这里返回一份最小文档：语义上仍然把访客送到 404 页，但显式声明 `noindex`，
 * 让搜索引擎直接丢弃该 URL。真正的 404 状态码需要服务端参与，静态托管下不可得，
 * 这是该约束下最接近正确的做法。
 *
 * 调用方式（保持各页面的 early-return 结构）：
 * ```ts
 * if (!someConfig.enable) {
 * 	return (await import("@utils/soft-404")).softNotFoundResponse();
 * }
 * ```
 *
 * **为什么用动态导入而不是静态 import**（两点，都别改回去）：
 * 1. 这个分支在功能启用时永远不执行，静态导入会把它拖进每个页面的模块图；
 * 2. Astro frontmatter 的类型分析不把「顶层 `return` 表达式里的引用」计入符号使用，
 *    静态导入会被 `astro check` 报成 `ts(6133) 声明但未使用`——是假报，但会污染诊断。
 */
export function softNotFoundResponse(): Response {
	const target = url("/404/");
	const body = [
		"<!doctype html>",
		"<html>",
		"<head>",
		'<meta charset="utf-8">',
		'<meta name="viewport" content="width=device-width, initial-scale=1">',
		// 关键：软 404 不参与索引
		'<meta name="robots" content="noindex, follow">',
		`<meta http-equiv="refresh" content="0;url=${target}">`,
		`<link rel="canonical" href="${target}">`,
		"<title>404 Not Found</title>",
		"</head>",
		"<body>",
		`<p><a href="${target}">404 Not Found</a></p>`,
		"</body>",
		"</html>",
	].join("");

	return new Response(body, {
		status: 404,
		headers: { "content-type": "text/html; charset=utf-8" },
	});
}
