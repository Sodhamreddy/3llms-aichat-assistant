var development = false;
var appURL = 'https://clonewebx.softlite.io';
if (development) {
    appURL = 'http://localhost:3000';
}

chrome.runtime.onMessage.addListener((event, sender, sendResponse) => {  
    if (event.type === "requestLogin") {
        const tabId = event.data;
        chrome.scripting.executeScript(
            {
                target: { tabId },
                function: () => {
                    chrome.runtime.sendMessage(
                        {
                            type: "loginSuccess",
                            data: {token: localStorage.getItem('token'), projects: localStorage.getItem('projects')}
                        }
                    );
                },
            }
        );
    }

    if (event.type === "loginSuccess") {
        const data = event.data;
        chrome.storage.local.set({clonewebxData:data});
        sendResponse(data);
    }

    if (event.type === "addPage") {
        const data = event.data;

		chrome.storage.local.get('clonewebxData', function(result) {
            if (!data.htmlId) {
                const options = {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${result.clonewebxData.token}`,
                    },
                    body: JSON.stringify({
                        url: data.url,
                        projectId: data.project,
                        pageHTML: data.html,
                        localhostCustomDomain: data.localhostCustomDomain
                    }),
                };
            
                fetch(appURL + "/api/v1/pages", options)
                .then((response) => response.json())
                .then((data) => {
                    if (data.success) {
                        const url = appURL + '/projects/' + data.data.page.project + '/' + data.data.page._id;
                        chrome.tabs.create({ url: url });
                    } else {
                        chrome.runtime.sendMessage(
                            {
                                type: "error",
                                data: data.error
                            }
                        );
                    }
                })
                .catch((error) => {
                    console.error("Error:", error);
                });
            } else {
                const options = {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${result.clonewebxData.token}`,
                    },
                    body: JSON.stringify({
                        url: data.url,
                        projectId: data.project,
                        htmlId: data.htmlId,
                        pageHTML: data.html,
                        localhostCustomDomain: data.localhostCustomDomain
                    }),
                };
            
                fetch(appURL + "/api/v1/html/" + data.htmlId, options)
                .then((response) => response.json())
                .then((data) => {
                    if (data.success) {
                        const page = data.data.page;
                        const url = appURL + '/projects/' + page.project + '/' + page._id;
                        chrome.tabs.create({ url: url });
                    } else {
                        chrome.runtime.sendMessage(
                            {
                                type: "error",
                                data: data.error
                            }
                        );
                    }
                })
                .catch((error) => {
                    console.error("Error:", error);
                });
            }
        });
    }

    return true;
});