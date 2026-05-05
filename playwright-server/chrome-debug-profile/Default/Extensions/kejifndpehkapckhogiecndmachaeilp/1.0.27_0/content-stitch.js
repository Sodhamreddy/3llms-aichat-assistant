chrome.runtime.onMessage.addListener((event, sender, sendResponse) => {
	
	if (event.type === "fetchHTML") {
		const project = event.data.project;
		const url = event.data.url;
		const htmlId = event.data.htmlId;
		const troubleshooting = event.data.troubleshooting;
        
        const htmlOuter = document.documentElement.outerHTML;
        const virtualDoc = new DOMParser().parseFromString(htmlOuter, "text/html");
        const iframe = virtualDoc?.querySelector('iframe[srcdoc]');
        const html = iframe?.getAttribute('srcdoc') || '';

        const data = {
            url: url,
            html: html,
        };

        if (htmlId) {
            data.htmlId = htmlId;
        }

        chrome.runtime.sendMessage({
            type: "addPage",
            data: data,
        });
	}

});

function isSrcdoc() {
	return window.frameElement?.hasAttribute('srcdoc');
}

var removedStyles = [];
  
const observer = new MutationObserver((mutationsList, observer) => {
	mutationsList.forEach((mutation) => {
		if (mutation.type === "childList") {
			mutation.removedNodes.forEach((node) => {
				if (node.tagName === "STYLE") {
					removedStyles.push(node.innerHTML);
				}
			});
		}
	});
});
  
observer.observe(document, { childList: true, subtree: true });

window.addEventListener("message", (event) => {
	if (event.data.type === "clonewebxIframeLoaded" && !event.data.data.url.startsWith('https') ) {
		const storage = chrome.storage.local;
		var iframe = document.querySelectorAll('.editor-iframe');
		if (iframe.length > 0) {
			iframe = iframe[0];
			const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
			const images = iframeDoc.querySelectorAll('img');
			images.forEach((image) => {
				const src = image.getAttribute('src');
				if (src) {
					chrome.storage.local.get(src).then((result) => {
						image.setAttribute('src', result[src]);
						image.removeAttribute('srcset');
					});
				}
			});
		}
	}
});

function clonewebxInsertAfter(referenceNode, newNode) {
    referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
}

function cleanCSS(cssContent) {
    return cssContent.replace(/<[^>]+>/g, ""); // Xóa tất cả thẻ HTML
}

async function fetchHTML(pageurl, troubleshooting) {
	const http = pageurl.startsWith('https') ? false : true;

	document.querySelectorAll('noscript, script').forEach((el) => {
		el.remove();
	});

    const newDoc = new DOMParser().parseFromString(
		document.documentElement.outerHTML,
		"text/html"
    );
  
	Array.from(
		newDoc.querySelectorAll(
			'script, link[as="script"], noscript, noscript link, noscript style',
		)
    ).forEach(el => {
        // Xóa nội dung trong thẻ trước
        if (el.tagName === 'SCRIPT' || el.tagName === 'NOSCRIPT') {
            el.textContent = ''; 
        }
        // Sau đó xóa chính thẻ
        el.remove();
    });

	Array.from(newDoc.querySelectorAll('svg')).forEach((i) => {
        if (i.querySelector('[id^="__lottie_element"]')) {
          	i.remove();
        }
	});

	Array.from(
		newDoc.querySelectorAll(
			'link[rel="stylesheet"]:not([type="text/css"])',
		)
    ).forEach((i) => i.setAttribute('type', 'text/css'));
  
    const promises = [];
	const promisesRedirect = [];
	const promisesImport = [];

	if (document.styleSheets.length) {
		for (let i = 0; i < document.styleSheets.length; i++) {
			const styleSheet = document.styleSheets[i];
			const { nodeName } = styleSheet.ownerNode;
			const el = styleSheet.ownerNode;
			
			if (nodeName.toLowerCase() === "link" && el.getAttribute('href')) {
				let href = el.getAttribute('href').startsWith('http') || el.getAttribute('href').startsWith('//') ? el.getAttribute('href') : new URL(el.getAttribute('href'), window.location.href).href;
				
				if (el.getAttribute('href').startsWith('//')) {
					href = 'https:' + el.getAttribute('href');
				}
				
				if (href.includes(".css") || el.getAttribute('rel').includes('stylesheet')) {
					hrefBtoa = 'https://clonewebx.softlite.io/api/v1/fetcher/' + btoa(href);

					if(troubleshooting) {
						el.setAttribute('href', hrefBtoa);
					} else {
						const promise = fetch(hrefBtoa, {mode: 'no-cors'})
							.then((response) => {
								return response.text();
							})
							.then((text) => {
								return { el: el, text: text, href: href };
							});

						promises.push(promise);
					}
				}
			}
		}
	}

	if (document.styleSheets.length) {
		for (let i = 0; i < document.styleSheets.length; i++) {
			const styleSheet = document.styleSheets[i];
			const el = styleSheet.ownerNode;

			let cssRules = null;

			try {
				cssRules = styleSheet.cssRules;
			} catch (e) {
				//
			}

			let appendToStyles = "";

			if (el.nodeName.toLowerCase() === "style" && el.innerHTML.trim().length === 0 && cssRules) {
				const rules = [];

				for (const rule of cssRules) {
					rules.push(rule);
				}

				const resolvedStyles = await Promise.all(
					rules.map((rule) =>
						rule.cssText
					)
				);

				appendToStyles = resolvedStyles.join(" ").concat(appendToStyles);

				const newStyleEl = newDoc.createElement("style");
				newStyleEl.innerHTML = cleanCSS(appendToStyles);
				
				newDoc.head.appendChild(newStyleEl);
			}
		}
	}

	const styleList = [];
  
    if (promises.length) {
		const resolvedPromises = await Promise.allSettled(promises);

		resolvedPromises.forEach((response) => {
			if (response.status === "fulfilled") {
				const responseValue = response.value;
				if (responseValue.text.trim() !== '' && !responseValue.text.trim().startsWith('<') && !responseValue.text.trim().startsWith('Found. Redirecting to')) {
					const newStyleEl = newDoc.createElement("style");
					let href = responseValue.el.getAttribute('href').startsWith('http') || responseValue.el.getAttribute('href').startsWith('//') ? responseValue.el.getAttribute('href') : new URL(responseValue.el.getAttribute('href'), window.location.href).href;
					
					if (href.startsWith('//')) {
						href = 'https:' + href;
					}
					
					newStyleEl.innerHTML = cleanCSS(responseValue.text.replace(/url\(.*?\)/ig, function(match) {
						const url = match.replace(/url\(|\)|\'|\"/ig, '');
						if (!url.startsWith('http') && !url.startsWith('data') && !url.startsWith('//')) {
							try {
								const newUrl = 'url(' + new URL(url, href).href + ')';
								return newUrl;
							} catch {
								return match;
							}
						} else {
							return match;
						}
					}));

					Array.from(
						newDoc.querySelectorAll(
							"[href='" + CSS.escape(responseValue.el.getAttribute('href')) + "']"
						)
					).forEach((i) => {
						if (responseValue.text.trim() !== '' && i.parentNode.tagName.toLowerCase() !== 'noscript') {
							i.replaceWith(newStyleEl);
						}
					});
				} else {
					const href = responseValue.href;
					const promise = fetch(href)
					.then((response) => {
						return response.text();
					})
					.then((text) => {
						return { el: responseValue.el, text: text, href: href };
					});
					promisesRedirect.push(promise);
				}
			}
		});
    }

	if (promisesRedirect.length) {
		const resolvedPromises = await Promise.allSettled(promisesRedirect);

		resolvedPromises.forEach((response) => {
			if (response.status === "fulfilled") {
				const responseValue = response.value;
				
				if (responseValue.text.trim() !== '' && !responseValue.text.trim().startsWith('<')) {
					
					const newStyleEl = newDoc.createElement("style");
					let href = responseValue.el.getAttribute('href').startsWith('http') || responseValue.el.getAttribute('href').startsWith('//') ? responseValue.el.getAttribute('href') : new URL(responseValue.el.getAttribute('href'), window.location.href).href;
					
					if (href.startsWith('//')) {
						href = 'https:' + href;
					}
					
					newStyleEl.innerHTML = cleanCSS(responseValue.text.replace(/url\(.*?\)/ig, function(match) {
						const url = match.replace(/url\(|\)|\'|\"/ig, '');
						if (!url.startsWith('http') && !url.startsWith('data') && !url.startsWith('//')) {
							try {
								const newUrl = 'url(' + new URL(url, href).href + ')';
								return newUrl;
							} catch {
								return match;
							}
						} else {
							return match;
						}
					}));
					
					Array.from(
						newDoc.querySelectorAll(
							"[href='" + CSS.escape(responseValue.el.getAttribute('href')) + "']"
						)
					).forEach((i) => {
						if (responseValue.text.trim() !== '' && i.parentNode.tagName.toLowerCase() !== 'noscript') {
							i.replaceWith(newStyleEl);
						}
					});
				}
			}
		});
    }

	if (newDoc.querySelectorAll('style').length) {
		let styleTotal = '';
		const style = newDoc.querySelectorAll('style');
		for (let i = 0; i < style.length; i++) {
			const el = style[i];
			const parent = el.parentNode;

			el.innerHTML = el.innerHTML.replace(/url\(.*?\)/ig, function(match) {
				const url = match.replace(/url\(|\)|\'|\"/ig, '');
				if (!url.startsWith('http') && !url.startsWith('data') && !url.startsWith('//')) {
					try {
						const newUrl = 'url(' + new URL(url, window.location.href).href + ')';
						return newUrl;
					} catch {
						return match;
					}
				} else {
					return match;
				}
			});

			if (parent.tagName.toLowerCase() !== 'noscript') {
				styleTotal += cleanCSS(el.innerHTML);
			}
			// el.remove();
		}
		// const newStyleElTotal = newDoc.createElement("clonewebxstyle");
		// newStyleElTotal.id = 'clonewebx-style';
		// newStyleElTotal.innerHTML = styleTotal;
		// newDoc.head.appendChild(newStyleElTotal);

		// add @import css to promises array
		// find all @import css url, url can contain ; 

		const importCss = styleTotal.match(/@import\s+url\(['"]([^'"]+)['"]\)|@import\s+['"]([^'"]+)['"];/g);
		const href = window.location.href;
		if (importCss) {
			importCss.forEach((i) => {
				const url = i.replace(/@import\s+url\(|\)|\'|\"|@import\s+/ig, '');
				const promise = fetch(new URL(url, href).href)
					.then((response) => response.text())
					.then((text) => {
						return text;
					});
				promisesImport.push(promise);
			});
		}
	}

	const styleTags = document.querySelectorAll('style[data-emotion]');

	if (promisesImport.length) {
		const resolvedPromisesImport = await Promise.allSettled(promisesImport);
		let importCSS = '';
		const styleEl = newDoc.getElementsByTagName('style')[0];
		resolvedPromisesImport.forEach((response) => {
			if (response.status === "fulfilled") {				
				importCSS += response.value;
			}
		});
		styleEl.innerHTML = cleanCSS(importCSS + styleEl.innerHTML);
	}

	Array.from(newDoc.querySelectorAll('[style]')).forEach((i) => {
		var styleInline = i.getAttribute('style');
		const href = window.location.href;
		var styleInlineNew = styleInline.replace(/url\(.*?\)/ig, function(match) {
			const url = match.replace(/url\(|\)|\'|\"/ig, '');
			if (!url.startsWith('http') && !url.startsWith('data') && !url.startsWith('//')) {
				try {
					const newUrl = 'url(' + new URL(url, href).href + ')';
					return newUrl;
				} catch {
					return match;
				}
			} else {
				return match;
			}
		});
		i.setAttribute('style', styleInlineNew);
	});

	Array.from(newDoc.querySelectorAll('[src]')).forEach((i) => {
		var imageSrc = i.getAttribute('src');
		if (imageSrc) {
			if (!imageSrc.startsWith('http') && !imageSrc.startsWith('//')) {
				imageSrc = new URL(imageSrc, window.location.href).href;
				i.setAttribute('src', imageSrc);
			}
		}

		if(http) {
			toDataURL(imageSrc, function(base64Image) {
				var storage = chrome.storage.local;

				var obj= {};

				obj[imageSrc] = base64Image;

				storage.set(obj);
			});
		}
	});

	Array.from(newDoc.querySelectorAll('[srcset]')).forEach((i) => {
		var imageSrcSet = i.getAttribute('srcset');

		if (imageSrcSet) {
			const newSrcSet = [];
			imageSrcSet.split(',').forEach((i) => {
				const url = i.split(' ')[0];
				if (!url.startsWith('http') && !url.startsWith('//')) {
					const newUrl = new URL(url, window.location.href).href;
					i = i.replace(url, newUrl);
				}
				newSrcSet.push(i);
			});

			i.setAttribute('srcset', newSrcSet.join(','));
		}
	});

	function toDataURL(url, callback) {
		var xhr = new XMLHttpRequest();
		xhr.onload = function() {
			var reader = new FileReader();
			reader.onloadend = function() {
				callback(reader.result);
			}
			reader.readAsDataURL(xhr.response);
		};
		xhr.open('GET', url);
		xhr.responseType = 'blob';
		xhr.send();
	}

	Array.from(newDoc.querySelectorAll('[*|href]:not([href])')).forEach((i) => {
		const imageSrc = i.getAttribute('xlink:href');
		if (imageSrc) {
			if (!imageSrc.startsWith('http') && !imageSrc.startsWith('//')) {
				i.setAttribute('xlink:href', new URL(imageSrc, window.location.href).href);
			}
		}
	});

	// Remove width, left style inline if element contains elementor-section-stretched class
	Array.from(newDoc.querySelectorAll('.elementor-section-stretched')).forEach((i) => {
		const style = i.getAttribute('style');
		const styleArr = style.split(';');
		const newStyleArr = [];
		for (let i = 0; i < styleArr.length; i++) {
			const styleItem = styleArr[i];
			if (!styleItem.includes('width') && !styleItem.includes('left')) {
				newStyleArr.push(styleItem);
			}
		}
		i.setAttribute('style', newStyleArr.join(';'));
	});

	if (troubleshooting) {
		removedStyles.forEach((i) => {
			const styleEl = newDoc.createElement('style');
			styleEl.innerHTML = cleanCSS(i);
			newDoc.head.appendChild(styleEl);
		});
	}

    return newDoc.documentElement.outerHTML;
}