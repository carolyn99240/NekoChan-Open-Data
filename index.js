const authConfig = {
	siteName: 'NekoChan Open Data', // 網站名稱
	version: '', // 程序版本。用戶不要手動修改
	client_id: '',
	client_secret: '',
	refresh_token: '', // 授權 token
	/**
	 * 設置要顯示的多個雲端硬碟；按格式添加多個
	 * [id]: 可以是 團隊盤id、子文件夾id、或者"root"（代表個人盤根目錄）
	 * [name]: 顯示的名稱
	 * [user]: Basic Auth 的使用者名稱
	 * [pass]: Basic Auth 的密碼
	 * [protect_file_link]: Basic Auth 是否用於保護文件連結，預設值（不設置時）為 false，即不保護文件連結（方便 直鏈下載/外部播放 等）
	 * 每個盤的 Basic Auth 都可以單獨設置。Basic Auth 默認保護該盤下所有文件夾/子文件夾路徑
	 * 【注意】默認不保護文件連結，這樣可以方便 直鏈下載/外部播放
	 *       如果要保護文件連結，需要將 protect_file_link 設置為 true，此時如果要進行外部播放等操作，需要將 host 替換為 user:pass@host 的 形式
	 * 不需要 Basic Auth 的盤，保持 user 和 pass 同時為空即可。（直接不設置也可以）
	 * 【注意】對於id設置為為子文件夾id的盤將不支持搜尋功能（不影響其他盤）。
	 */
	roots: [
		{
			id: 'root',
			name: '主目錄',
		},
	],
	/**
	 * 文件列表頁面每頁顯示的數量。【推薦設置值為 100 到 1000 之間】；
	 * 如果設置大於1000，會導致請求 drive api 時出錯；
	 * 如果設置的值過小，會導致文件列表頁面滾動條增量載入（分頁載入）失效；
	 * 此值的另一個作用是，如果目錄內文件數大於此設置值（即需要多頁展示的），將會對首次列目錄結果進行快取。
	 */
	files_list_page_size: 35,
	/**
	 * 搜索結果頁面每頁顯示的數量。【推薦設置值為 50 到 1000 之間】；
	 * 如果設置大於1000，會導致請求 drive api 時出錯；
	 * 如果設置的值過小，會導致搜索結果頁面滾動條增量載入（分頁載入）失效；
	 * 此值的大小影響搜索操作的響應速度。
	 */
	search_result_list_page_size: 50,
	// 確認有 cors 用途的可以開啟
	enable_cors_file_down: false,
	/**
	 * 上面的 basic auth 已經包含了盤內全局保護的功能。所以默認不再去認證 .password 文件內的密碼
	 * 如果在全局認證的基礎上，仍需要給某些目錄單獨進行 .password 文件內的密碼驗證的話，將此选项設置為 true
	 * 【注意】如果開啟了 .password 文件密碼驗證，每次列目錄都會額外增加查詢目錄內 .password 文件是否存在的開銷。
	 */
	enable_password_file_verify: false,
}

/**
 * web ui 設置
 */
const uiConfig = {
	theme: 'material',
	dark_mode: !0,
	main_color: 'blue',
	accent_color: 'blue',
	fluid_navigation_bar: !0,
}

/**
 * global functions
 */
const FUNCS = {
	/**
	 * 轉換成針對Google搜索詞法相對安全的搜索關鍵字
	 */
	formatSearchKeyword: function (keyword) {
		let nothing = ''
		let space = ' '
		if (!keyword) return nothing
		return keyword
			.replace(/(!=)|['"=<>/\\:]/g, nothing)
			.replace(/[,，|(){}]/g, space)
			.trim()
	},
}

/**
 * global consts
 * @type {{folder_mime_type: string, default_file_fields: string, gd_root_type: {share_drive: number, user_drive: number, sub_folder: number}}}
 */
const CONSTS = new (class {
	default_file_fields =
		'parents,id,name,mimeType,modifiedTime,createdTime,fileExtension,size'
	gd_root_type = {
		user_drive: 0,
		share_drive: 1,
		sub_folder: 2,
	}
	folder_mime_type = 'application/vnd.google-apps.folder'
})()

// gd instances
var gds = []

function html(current_drive_order = 0, model = {}) {
	return `
<!DOCTYPE html>
<html lang="zh-Hant-TW">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0,maximum-scale=1.0, user-scalable=no"/>
    <meta name="description" content="NekoChan分享檔案的網站" />
    <meta property="og:title" content="NekoChan Open Data">
    <meta property="og:description" content="NekoChan分享檔案的網站">
    <meta property="og:url" content="//nekochan.ml/">
    <meta property="og:locale" content="zh-Hant-TW">
    <meta property="og:image" content="//cdn.jsdelivr.net/gh/NekoChanTaiwan/NekoChan-Open-Data@1.6.3.1/images/image_0.webp">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="NekoChan Open Data">
    <title>${authConfig.siteName}</title>
    <link rel="shortcut icon" href="//cdn.jsdelivr.net/gh/NekoChanTaiwan/NekoChan-Open-Data/images/logo.webp" type="image/x-icon" />
    <link rel="stylesheet" href="//cdnjs.cloudflare.com/ajax/libs/mdui/1.0.1/css/mdui.min.css" integrity="sha512-x4mi26uahzsFv2+ZklhOELAiuLt2e+hSxQ/SWbW/FuZWZJSc4Ffb33Al7SmPqXXyZieN2rNxBiDsRqAtGKsxUA==" crossorigin="anonymous" />
    <link rel="preconnect" href="//fonts.gstatic.com">
    <link href="//fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@500&family=Noto+Sans+SC:wght@500&family=Noto+Sans+TC:wght@500&display=swap" rel="stylesheet">
    <style>*{font-family:'Noto Sans TC','Noto Sans JP','Noto Sans SC',serif}a{text-decoration:none}a:link{color:rgba(255,255,255,.87)}a:visited{color:rgba(255,255,255,.87)}body{margin:0;padding:0;background:url(//cdn.jsdelivr.net/gh/NekoChanTaiwan/NekoChan-Open-Data@1.8.2.beta16/images/background_3.webp);background-attachment:fixed;background-repeat:no-repeat;background-position:center center;background-size:cover}.mdui-theme-primary-blue .mdui-color-theme{background-color:rgb(45 45 45 / 95%)!important}.mdui-appbar{padding-right:8px;padding-left:8px;margin-right:auto;margin-left:auto;max-width:1265px}.mdui-container,.mdui-textfield-input{color:rgba(255,255,255,.87);background-color:rgb(45 45 45 / 95%)}.updating{color:rgb(251 191 72 / 87%)!important}.finish{color:rgb(255 106 106 / 87%)!important}.r18{color:rgb(249 67 177 / 87%)!important}.mdui-appbar .mdui-toolbar{height:56px;font-size:1px}.mdui-toolbar>*{padding:0 6px;margin:0 2px}.mdui-toolbar>.mdui-typo-headline{padding:0 1pc 0 0}.mdui-toolbar>i{padding:0;opacity:.5}.mdui-toolbar>a:hover,a.active,a.mdui-typo-headline{opacity:1}.mdui-list-item{transition:none}.mdui-list>.th{background-color:initial}.mdui-list-item>a{width:100%;line-height:3pc}.mdui-list-item{margin:2px 0;padding:0}.mdui-toolbar>a:last-child{opacity:1}@media screen and (max-width:980px){.mdui-list-item .mdui-text-right{display:none}.mdui-container{width:100%!important;margin:0}.mdui-toolbar>.mdui-typo-headline,.mdui-toolbar>a:last-child,.mdui-toolbar>i:first-child{display:block}}</style>
    <script>
		window.drive_names = JSON.parse('${JSON.stringify(
				authConfig.roots.map((it) => it.name)
			)}')
		window.MODEL = JSON.parse('${JSON.stringify(model)}')
		window.current_drive_order = ${current_drive_order}
		window.UI = JSON.parse('${JSON.stringify(uiConfig)}')
    </script>
    <script src="//cdn.jsdelivr.net/npm/jquery@3.5.1/dist/jquery.min.js"></script>
    <script src="//cdn.jsdelivr.net/npm/mdui@1.0.1/dist/js/mdui.min.js"></script>
    <script src="//cdnjs.cloudflare.com/ajax/libs/markdown-it/12.0.4/markdown-it.min.js" integrity="sha512-0DkA2RqFvfXBVeti0R1l0E8oMkmY0X+bAA2i02Ld8xhpjpvqORUcE/UBe+0KOPzi5iNah0aBpW6uaNNrqCk73Q==" crossorigin="anonymous" async></script>
    <script src="//cdn.jsdelivr.net/gh/NekoChanTaiwan/NekoChan-Open-Data@1.9.1.DPlayer.min2/js/DPlayer-1.26.0.min.edit.js" async></script>
    <script src="//cdn.jsdelivr.net/gh/NekoChanTaiwan/NekoChan-Open-Data@${
			authConfig.version
		}/app.js"></script>
</head>
<body>
</body>
</html>
`
}

addEventListener('fetch', (e) => {
	e.respondWith(handleRequest(e.request))
})

/**
 * Fetch and log a request
 * @param {Request} request
 */
async function handleRequest(request) {
	if (gds.length === 0) {
		for (let i = 0; i < authConfig.roots.length; i++) {
			const gd = new googleDrive(authConfig, i)
			await gd.init()
			gds.push(gd)
		}
		// 這個操作並行，提高效率
		let tasks = []
		gds.forEach((gd) => {
			tasks.push(gd.initRootType())
		})
		for (let task of tasks) {
			await task
		}
	}

	// 從 path 中提取 drive order
	// 並根據 drive order 獲取對應的 gd instance
	let gd,
		url = new URL(request.url),
		path = url.pathname

	/**
	 * 重定向至起始頁
	 * @returns {Response}
	 */
	function redirectToIndexPage() {
		return new Response('', {
			status: 301,
			headers: { Location: `${url.origin}/0:/` },
		})
	}

	if (path == '/') return redirectToIndexPage()
	if (path.toLowerCase() == '/favicon.ico') {
		// 後面可以找一個 favicon
		return new Response('', { status: 404 })
	}

	// 特殊命令格式
	const command_reg = /^\/(?<num>\d+):(?<command>[a-zA-Z0-9]+)$/g
	const match = command_reg.exec(path)
	if (match) {
		const num = match.groups.num
		const order = Number(num)
		if (order >= 0 && order < gds.length) {
			gd = gds[order]
		} else {
			return redirectToIndexPage()
		}
		// basic auth
		for (const r = gd.basicAuthResponse(request); r; ) return r
		const command = match.groups.command
		// 搜索
		if (command === 'search') {
			if (request.method === 'POST') {
				// 搜索結果
				return handleSearch(request, gd)
			} else {
				const params = url.searchParams
				// 搜索頁面
				return new Response(
					html(gd.order, {
						q: params.get('q') || '',
						is_search_page: true,
						root_type: gd.root_type,
					}),
					{
						status: 200,
						headers: { 'Content-Type': 'text/html; charset=utf-8' },
					}
				)
			}
		} else if (command === 'id2path' && request.method === 'POST') {
			return handleId2Path(request, gd)
		}
	}

	// 期望的 path 格式
	const common_reg = /^\/\d+:\/.*$/g
	try {
		if (!path.match(common_reg)) {
			return redirectToIndexPage()
		}
		let split = path.split('/'),
			order = Number(split[1].slice(0, -1))
		if (order >= 0 && order < gds.length) {
			gd = gds[order]
		} else {
			return redirectToIndexPage()
		}
	} catch (e) {
		return redirectToIndexPage()
	}

	// basic auth
	// for (const r = gd.basicAuthResponse(request); r;) return r;
	const basic_auth_res = gd.basicAuthResponse(request)

	path = path.replace(gd.url_path_prefix, '') || '/'
	if (request.method == 'POST') {
		return basic_auth_res || apiRequest(request, gd)
	}

	let action = url.searchParams.get('a')

	if (path.substr(-1) == '/' || action != null) {
		return (
			basic_auth_res ||
			new Response(html(gd.order, { root_type: gd.root_type }), {
				status: 200,
				headers: { 'Content-Type': 'text/html; charset=utf-8' },
			})
		)
	} else {
		if (path.split('/').pop().toLowerCase() == '.password') {
			return basic_auth_res || new Response('', { status: 404 })
		}
		let file = await gd.file(path)
		let range = request.headers.get('Range')
		const inline_down = 'true' === url.searchParams.get('inline')
		if (gd.root.protect_file_link && basic_auth_res) return basic_auth_res
		return gd.down(file.id, range, inline_down)
	}
}

async function apiRequest(e,t){let i=new URL(e.url).pathname,s={status:200,headers:{"Access-Control-Allow-Origin":"*"}};if("/"==(i=i.replace(t.url_path_prefix,"")||"/").substr(-1)){let a=await e.formData(),n=t.list(i,a.get("page_token"),Number(a.get("page_index")));if(authConfig.enable_password_file_verify){let e=await t.password(i);if(e&&e.replace("\n","")!==a.get("password"))return new Response('{"error": {"code": 401,"message": "password error."}}',s)}let r=await n;return new Response(JSON.stringify(r),s)}{let s=await t.file(i);return e.headers.get("Range"),new Response(JSON.stringify(s))}}async function handleSearch(e,t){let i=await e.formData(),s=await t.search(i.get("q")||"",i.get("page_token"),Number(i.get("page_index")));return new Response(JSON.stringify(s),{status:200,headers:{"Access-Control-Allow-Origin":"*"}})}async function handleId2Path(e,t){let i=await e.formData(),s=await t.findPathById(i.get("id"));return new Response(s||"",{status:200,headers:{"Access-Control-Allow-Origin":"*"}})}class googleDrive{constructor(e,t){this.order=t,this.root=e.roots[t],this.root.protect_file_link=this.root.protect_file_link||!1,this.url_path_prefix=`/${t}:`,this.authConfig=e,this.paths=[],this.files=[],this.passwords=[],this.id_path_cache={},this.id_path_cache[this.root.id]="/",this.paths["/"]=this.root.id}async init(){if(await this.accessToken(),authConfig.user_drive_real_root_id)return;const e=await(gds[0]||this).findItemById("root");e&&e.id&&(authConfig.user_drive_real_root_id=e.id)}async initRootType(){const e=this.root.id,t=CONSTS.gd_root_type;if("root"===e||e===authConfig.user_drive_real_root_id)this.root_type=t.user_drive;else{const i=await this.getShareDriveObjById(e);this.root_type=i?t.share_drive:t.sub_folder}}basicAuthResponse(e){const t=this.root.user||"",i=this.root.pass||"",s=new Response("Unauthorized",{headers:{"WWW-Authenticate":`Basic realm="goindex:drive:${this.order}"`},status:401});if(!t&&!i)return null;{const a=e.headers.get("Authorization");if(a)try{const[n,r]=atob(a.split(" ").pop()).split(":");return n===t&&r===i?null:s}catch(e){}}return s}async down(e,t="",i=!1){let s=`https://www.googleapis.com/drive/v3/files/${e}?alt=media`,a=await this.requestOption();a.headers.Range=t;let n=await fetch(s,a);const{headers:r}=n=new Response(n.body,n);return this.authConfig.enable_cors_file_down&&r.append("Access-Control-Allow-Origin","*"),!0===i&&r.set("Content-Disposition","inline"),n}async file(e){return void 0===this.files[e]&&(this.files[e]=await this._file(e)),this.files[e]}async _file(e){let t=e.split("/"),i=t.pop();i=decodeURIComponent(i).replace(/\'/g,"\\'");let s=t.join("/")+"/",a=await this.findPathId(s),n="https://www.googleapis.com/drive/v3/files",r={includeItemsFromAllDrives:!0,supportsAllDrives:!0};r.q=`'${a}' in parents and name = '${i}' and trashed = false`,r.fields="files(id, name, mimeType, size ,createdTime, modifiedTime, iconLink, thumbnailLink)",n+="?"+this.enQuery(r);let o=await this.requestOption(),l=await fetch(n,o);return(await l.json()).files[0]}async list(e,t=null,i=0){if(null==this.path_children_cache&&(this.path_children_cache={}),this.path_children_cache[e]&&this.path_children_cache[e][i]&&this.path_children_cache[e][i].data){let t=this.path_children_cache[e][i];return{nextPageToken:t.nextPageToken||null,curPageIndex:i,data:t.data}}let s=await this.findPathId(e),a=await this._ls(s,t,i),n=a.data;return a.nextPageToken&&n.files&&(Array.isArray(this.path_children_cache[e])||(this.path_children_cache[e]=[]),this.path_children_cache[e][Number(a.curPageIndex)]={nextPageToken:a.nextPageToken,data:n}),a}async _ls(e,t=null,i=0){if(null==e)return null;let s,a={includeItemsFromAllDrives:!0,supportsAllDrives:!0};a.q=`'${e}' in parents and trashed = false AND name !='.password'`,a.orderBy="name_natural,folder,modifiedTime desc",a.fields="nextPageToken, files(id, name, mimeType, size , modifiedTime)",a.pageSize=this.authConfig.files_list_page_size,t&&(a.pageToken=t);let n="https://www.googleapis.com/drive/v3/files";n+="?"+this.enQuery(a);let r=await this.requestOption(),o=await fetch(n,r);return{nextPageToken:(s=await o.json()).nextPageToken||null,curPageIndex:i,data:s}}async password(e){if(void 0!==this.passwords[e])return this.passwords[e];let t=await this.file(e+".password");if(null==t)this.passwords[e]=null;else{let i=`https://www.googleapis.com/drive/v3/files/${t.id}?alt=media`,s=await this.requestOption(),a=await this.fetch200(i,s);this.passwords[e]=await a.text()}return this.passwords[e]}async getShareDriveObjById(e){if(!e)return null;if("string"!=typeof e)return null;let t=`https://www.googleapis.com/drive/v3/drives/${e}`,i=await this.requestOption(),s=await fetch(t,i),a=await s.json();return a&&a.id?a:null}async search(e,t=null,i=0){const s=CONSTS.gd_root_type,a=this.root_type===s.user_drive,n=this.root_type===s.share_drive,r={nextPageToken:null,curPageIndex:i,data:null};if(!a&&!n)return r;let o=FUNCS.formatSearchKeyword(e);if(!o)return r;let l=`name contains '${o.split(/\s+/).join("' AND name contains '")}'`,h={};a&&(h.corpora="user"),n&&(h.corpora="drive",h.driveId=this.root.id,h.includeItemsFromAllDrives=!0,h.supportsAllDrives=!0),t&&(h.pageToken=t),h.q=`trashed = false AND name !='.password' AND (${l})`,h.fields="nextPageToken, files(id, name, mimeType, size , modifiedTime)",h.pageSize=this.authConfig.search_result_list_page_size,h.orderBy="folder,name_natural,modifiedTime desc";let d="https://www.googleapis.com/drive/v3/files";d+="?"+this.enQuery(h);let c=await this.requestOption(),p=await fetch(d,c),u=await p.json();return{nextPageToken:u.nextPageToken||null,curPageIndex:i,data:u}}async findParentFilesRecursion(e,t=!0){const i=this,s=i.root.id,a=authConfig.user_drive_real_root_id,n=i.root_type===CONSTS.gd_root_type.user_drive?a:s,r=(CONSTS.default_file_fields,[]);let o=!1;const l=await i.findItemById(e);return t&&r.push(l),await async function e(t){if(!t)return;if(!t.parents)return;if(t.parents.length<1)return;let s=t.parents;if(s&&s.length>0){const t=s[0];if(t===n)return void(o=!0);const a=await i.findItemById(t);a&&a.id&&(r.push(a),await e(a))}}(l),o?r:null}async findPathById(e){if(this.id_path_cache[e])return this.id_path_cache[e];const t=await this.findParentFilesRecursion(e);if(!t||t.length<1)return"";let i=[];return t.forEach((e,s)=>{const a=0!==s||t[s].mimeType===CONSTS.folder_mime_type;let n="/"+t.slice(s).map(e=>e.name).reverse().join("/");a&&(n+="/"),i.push({id:t[s].id,path:n})}),i.forEach(e=>{this.id_path_cache[e.id]=e.path,this.paths[e.path]=e.id}),i[0].path}async findItemById(e){const t=this.root_type===CONSTS.gd_root_type.user_drive;let i=`https://www.googleapis.com/drive/v3/files/${e}?fields=${CONSTS.default_file_fields}${t?"":"&supportsAllDrives=true"}`,s=await this.requestOption(),a=await fetch(i,s);return await a.json()}async findPathId(e){let t="/",i=this.paths[t],s=e.trim("/").split("/");for(let e of s){if(t+=e+"/",void 0===this.paths[t]){let s=await this._findDirId(i,e);this.paths[t]=s}if(null==(i=this.paths[t])||null==i)break}return this.paths[e]}async _findDirId(e,t){if(t=decodeURIComponent(t).replace(/\'/g,"\\'"),null==e)return null;let i="https://www.googleapis.com/drive/v3/files",s={includeItemsFromAllDrives:!0,supportsAllDrives:!0};s.q=`'${e}' in parents and mimeType = 'application/vnd.google-apps.folder' and name = '${t}'  and trashed = false`,s.fields="nextPageToken, files(id, name, mimeType)",i+="?"+this.enQuery(s);let a=await this.requestOption(),n=await fetch(i,a),r=await n.json();return null==r.files[0]?null:r.files[0].id}async accessToken(){if(console.log("accessToken"),null==this.authConfig.expires||this.authConfig.expires<Date.now()){const e=await this.fetchAccessToken();null!=e.access_token&&(this.authConfig.accessToken=e.access_token,this.authConfig.expires=Date.now()+35e5)}return this.authConfig.accessToken}async fetchAccessToken(){console.log("fetchAccessToken");const e={client_id:this.authConfig.client_id,client_secret:this.authConfig.client_secret,refresh_token:this.authConfig.refresh_token,grant_type:"refresh_token"};let t={method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:this.enQuery(e)};const i=await fetch("https://www.googleapis.com/oauth2/v4/token",t);return await i.json()}async fetch200(e,t){let i;for(let s=0;s<3&&(i=await fetch(e,t),console.log(i.status),403==i.status);s++)await this.sleep(800*(s+1));return i}async requestOption(e={},t="GET"){const i=await this.accessToken();return e.authorization="Bearer "+i,{method:t,headers:e}}enQuery(e){const t=[];for(let i in e)t.push(encodeURIComponent(i)+"="+encodeURIComponent(e[i]));return t.join("&")}sleep(e){return new Promise(function(t,i){let s=0;setTimeout(function(){console.log("sleep"+e),++s>=2?i(new Error("i>=2")):t(s)},e)})}}String.prototype.trim=function(e){return e?this.replace(new RegExp("^\\"+e+"+|\\"+e+"+$","g"),""):this.replace(/^\s+|\s+$/g,"")};