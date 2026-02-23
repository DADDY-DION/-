document.addEventListener('DOMContentLoaded', () => {
    const statusMessage = document.getElementById('statusMessage');
    const chatContainer = document.getElementById('chatContainer');
    const btnSpeakZh = document.getElementById('btnSpeakZh');
    const btnSpeakJa = document.getElementById('btnSpeakJa');

    // 檢查瀏覽器支援
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        showError('您的瀏覽器不支援語音辨識。請使用 Google Chrome 或 Safari。');
        btnSpeakZh.disabled = true;
        btnSpeakJa.disabled = true;
        return;
    }

    let recognition = new SpeechRecognition();
    recognition.continuous = false; // 每次對話結束就停止
    recognition.interimResults = false; // 只取最終結果

    let currentSourceLang = '';
    let currentTargetLang = '';

    // 初始化翻譯服務 (這裡先用一個免費的公開 API，實際應用可能需要替換為更穩定的服務)
    // 使用 MyMemory Translation API
    async function translateText(text, sourceLang, targetLang) {
        try {
            statusMessage.textContent = '翻譯中...';
            // MyMemory API limits to 500 words/day for free without email
            const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`);
            const data = await response.json();

            if (data.responseStatus === 200) {
                return data.responseData.translatedText;
            } else {
                throw new Error("翻譯失敗 API 回應錯誤");
            }
        } catch (error) {
            console.error('Translation error:', error);
            return '[翻譯服務暫時不可用，請稍後再試]';
        }
    }

    // 語音朗讀
    function speakText(text, lang) {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = lang === 'ja' ? 'ja-JP' : 'zh-TW';
            // 稍微放慢語速，讓長輩或對方聽得更清楚
            utterance.rate = 0.9;
            window.speechSynthesis.speak(utterance);
        }
    }

    // 更新 UI 顯示對話
    function addMessageToChat(originalText, translatedText, type) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${type}`;

        const origDiv = document.createElement('div');
        origDiv.className = 'original';
        origDiv.textContent = originalText;

        const transDiv = document.createElement('div');
        transDiv.className = 'translated';
        transDiv.textContent = translatedText;

        const replayBtn = document.createElement('button');
        replayBtn.className = 'replay-btn';
        replayBtn.innerHTML = '🔊';
        replayBtn.title = '重新播放';
        replayBtn.onclick = () => {
            const targetLang = type === 'zh' ? 'ja' : 'zh-TW';
            speakText(translatedText, targetLang);
        };

        msgDiv.appendChild(origDiv);
        msgDiv.appendChild(transDiv);
        msgDiv.appendChild(replayBtn);
        chatContainer.appendChild(msgDiv);

        // 捲動到底部
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function showError(msg) {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'message error';
        msgDiv.textContent = msg;
        chatContainer.appendChild(msgDiv);
        statusMessage.textContent = '發生錯誤';
        statusMessage.classList.remove('recording');
    }

    // 處理語音辨識結果
    recognition.onresult = async (event) => {
        const text = event.results[0][0].transcript;
        statusMessage.textContent = '辨識完成，準備翻譯...';
        statusMessage.classList.remove('recording');

        // 決定翻譯方向
        let langCodeSource = currentSourceLang === 'zh-TW' ? 'zh-TW' : 'ja';
        let langCodeTarget = currentSourceLang === 'zh-TW' ? 'ja' : 'zh-TW';
        let uiType = currentSourceLang === 'zh-TW' ? 'zh' : 'ja';

        const translatedText = await translateText(text, langCodeSource, langCodeTarget);

        addMessageToChat(text, translatedText, uiType);
        statusMessage.textContent = '準備就緒';

        // 朗讀翻譯結果
        speakText(translatedText, langCodeTarget);
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        statusMessage.classList.remove('recording');

        let errorMsg = '無法辨識語音。';
        if (event.error === 'not-allowed') {
            errorMsg = '請允許使用麥克風權限！';
        } else if (event.error === 'no-speech') {
            errorMsg = '沒有偵測到聲音，請再說一次。';
        }

        showError(errorMsg);

        // 恢復按鈕狀態
        btnSpeakZh.classList.remove('active');
        btnSpeakJa.classList.remove('active');
    };

    recognition.onend = () => {
        statusMessage.classList.remove('recording');
        btnSpeakZh.classList.remove('active');
        btnSpeakJa.classList.remove('active');
    };

    // 綁定按鈕事件
    function startRecording(lang, langCode, btnElement) {
        currentSourceLang = lang;
        recognition.lang = lang;

        btnElement.classList.add('active');
        statusMessage.textContent = '正在聆聽... 請說話';
        statusMessage.classList.add('recording');

        try {
            recognition.start();
        } catch (e) {
            // 如果已經在錄音中又按了一次
            console.warn(e);
        }
    }

    btnSpeakZh.addEventListener('click', () => {
        startRecording('zh-TW', 'zh-TW', btnSpeakZh);
    });

    btnSpeakJa.addEventListener('click', () => {
        // iOS 系統對於 ja-JP 的支援度比較好，Windows 也是
        startRecording('ja-JP', 'ja', btnSpeakJa);
    });

    // 圖片翻譯邏輯
    const btnCamera = document.getElementById('btnCamera');
    const imageInput = document.getElementById('imageInput');
    const overlayModal = document.getElementById('overlayModal');
    const sourceImage = document.getElementById('sourceImage');
    const labelLayer = document.getElementById('labelLayer');
    const closeModal = document.getElementById('closeModal');
    const debugRawText = document.getElementById('debugRawText');

    btnCamera.addEventListener('click', () => {
        imageInput.click();
    });

    closeModal.addEventListener('click', () => {
        overlayModal.style.display = 'none';
        labelLayer.innerHTML = '';
        debugRawText.textContent = '';
    });

    imageInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // 預覽圖片
        const reader = new FileReader();
        reader.onload = (event) => {
            sourceImage.src = event.target.result;
            overlayModal.style.display = 'flex';
        };
        reader.readAsDataURL(file);

        statusMessage.textContent = '分析圖片中 (OCR)... 請稍候';
        statusMessage.classList.add('recording');

        try {
            // 使用 Tesseract.js 辨識並取得詳細座標 (blocks/lines)
            // 嘗試調整優化參數以增加辨識率
            const worker = await Tesseract.createWorker('jpn');
            const { data } = await worker.recognize(file);
            await worker.terminate();

            if (!data.text.trim()) {
                showError('圖片中找不到文字。');
                return;
            }

            // 顯示原始文字供除錯
            debugRawText.textContent = data.text;

            // 清除舊標籤
            labelLayer.innerHTML = '';

            // 取得圖片顯示的實際比例 (因為 CSS 可能縮放圖片)
            const imgWidth = sourceImage.naturalWidth;
            const imgHeight = sourceImage.naturalHeight;

            // 處理每一行文字
            for (const line of data.lines) {
                const text = line.text.replace(/\s+/g, '').trim();
                if (text.length < 1) continue;

                // 翻譯這一行
                const translated = await translateText(text, 'ja', 'zh-TW');

                // 建立覆蓋標籤
                const label = document.createElement('div');
                label.className = 'trans-label';
                label.textContent = translated;

                // 計算位置 (百分比單位，適應任何縮放)
                const { x0, y0, x1, y1 } = line.bbox;
                label.style.left = `${(x0 / imgWidth) * 100}%`;
                label.style.top = `${(y0 / imgHeight) * 100}%`;
                label.style.width = `${((x1 - x0) / imgWidth) * 100}%`;
                label.style.height = `${((y1 - y0) / imgHeight) * 100}%`;

                // 點擊朗讀
                label.onclick = (event) => {
                    event.stopPropagation();
                    speakText(translated, 'zh-TW');
                };

                labelLayer.appendChild(label);
            }

            statusMessage.textContent = '分析完畢';
            addMessageToChat('[圖片翻譯]', '已於視窗中顯示覆蓋內容。', 'ja');

        } catch (error) {
            console.error('OCR Error:', error);
            showError('圖片辨識失敗。');
        } finally {
            statusMessage.classList.remove('recording');
            imageInput.value = '';
        }
    });
});
