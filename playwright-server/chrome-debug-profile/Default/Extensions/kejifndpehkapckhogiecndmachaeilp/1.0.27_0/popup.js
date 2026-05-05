window.onload = function() {
    var development = false;
    var appURL = 'https://clonewebx.softlite.io';
    if (development) {
        appURL = 'http://localhost:3000';
    }

    if(development) {
        chrome.tabs.query({ url: ['http://localhost:3000/*'] }, (tabs) => {
            if (tabs.length) {
                const appTabs = tabs.filter((t) =>
                    t.url.match(/http:\/\/localhost:3000/)
                );
                if (appTabs.length) {
                    chrome.runtime.sendMessage(
                        {
                            type: "requestLogin",
                            data: appTabs[0].id,
                        }
                    );
                }
            }
        });
    } else {
        chrome.tabs.query({ url: ['https://clonewebx.softlite.io/*'] }, (tabs) => {
            if (tabs.length) {
                const appTabs = tabs.filter((t) =>
                    t.url.match(/https:\/\/clonewebx.softlite.io/)
                );
                if (appTabs.length) {
                    chrome.runtime.sendMessage(
                        {
                            type: "requestLogin",
                            data: appTabs[0].id,
                        }
                    );
                }
            }
        });
    }

    function removeError() {
        document.querySelectorAll('[data-error]').forEach((el) => {
            el.classList.remove("active");
            el.innerHTML = "";
        });
    }

    function setError($message) {
        document.body.classList.remove("loading");
        document.querySelectorAll('[data-error]').forEach((el) => {
            el.classList.add("active");
            el.innerHTML = $message;
        });
    }

    chrome.runtime.onMessage.addListener((event, sender, sendResponse) => {
        const data = event.data;

        if (event.type === "loginSuccess") {
            const data = event.data;
            document.body.classList.add("logged-in");
        }

        if (event.type === "error") {
            document.body.classList.remove("loading");
            setError(data);
        }
    
        return true;
    });

    document.getElementById("add-page").addEventListener("click", (e) => {
        const troubleshooting = document.getElementById("troubleshooting").checked;

        document.body.classList.add("loading");
        removeError();
        chrome.tabs.query({currentWindow: true, active: true}, function (tabs){
            var activeTab = tabs[0];
            chrome.tabs.sendMessage(
                activeTab.id,
                {
                    type: "fetchHTML",
                    data: {troubleshooting: troubleshooting, url: activeTab.url, activeTab: activeTab}
                }
            );
        });
    })

    document.querySelectorAll("[data-tab]").forEach(el=> {
        el.addEventListener("click", (e) => {
            document.querySelectorAll("[data-tab]").forEach(tabEl=> {
                tabEl.classList.remove("active");
            });
            el.classList.add('active');
            const tab = el.dataset.tab;
            document.querySelectorAll("[data-tab-content]").forEach(tabEl=> {
                tabEl.classList.remove("active");
            });
            document.querySelector("[data-tab-content='" + tab + "']").classList.add("active");
        });
    });

    document.getElementById("login-button").addEventListener("click", (e) => {
        e.preventDefault();
        window.open(appURL, "_blank");
    });

    var extDetailsLink = document.getElementById("open-extension-details");
    if (extDetailsLink) {
        extDetailsLink.addEventListener("click", function (e) {
            e.preventDefault();
            chrome.tabs.create({
                url: "chrome://extensions/?id=" + chrome.runtime.id,
            });
        });
    }

    var localHtmlToggle = document.getElementById("local-html-toggle");
    var localHtmlDetails = document.getElementById("local-html-details");
    if (localHtmlToggle && localHtmlDetails) {
        localHtmlToggle.addEventListener("click", function () {
            var open = localHtmlDetails.hidden;
            localHtmlDetails.hidden = !open;
            localHtmlToggle.setAttribute("aria-expanded", open ? "true" : "false");
            localHtmlToggle.textContent = open ? "View less" : "View more";
        });
    }

}