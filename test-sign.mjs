import { createHmac, randomUUID } from 'crypto';

function uuid() {
    return randomUUID().replace(/-/g, "");
}

function dateFormat() {
    const formattedDate = (new Date()).toUTCString().replace(/GMT/, "").trim() + " GMT";
    return formattedDate.toLowerCase();
}

function base64ToBytes(base64) {
    return Buffer.from(base64, 'base64');
}

function bytesToBase64(bytes) {
    return bytes.toString('base64');
}

function hmacSha256(key, data) {
    const signature = createHmac('sha256', key).update(data).digest();
    return signature;
}

async function sign(urlStr) {
    const url = urlStr.split("://")[1];
    const encodedUrl = encodeURIComponent(url);
    const uuidStr = uuid();
    const formattedDate = dateFormat();
    const bytesToSign = `MSTranslatorAndroidApp${encodedUrl}${formattedDate}${uuidStr}`.toLowerCase();
    const decode = base64ToBytes("oik6PdDdMnOXemTbwvMn9de/h9lFnfBaCWbGMMZqqoSaQaqUOqjVGm5NqsmjcBI1x+sS9ugjB55HEJWRiFXYFw==");
    const signData = hmacSha256(decode, bytesToSign);
    const signBase64 = bytesToBase64(signData);
    return `MSTranslatorAndroidApp::${signBase64}::${formattedDate}::${uuidStr}`;
}

async function getEndpoint() {
    const endpointUrl = "https://dev.microsofttranslator.com/apps/endpoint?api-version=1.0";
    const clientId = uuid();
    const signature = await sign(endpointUrl);
    
    console.log("Signature:", signature);
    
    try {
        const response = await fetch(endpointUrl, {
            method: "POST",
            headers: {
                "Accept-Language": "zh-Hans",
                "X-ClientVersion": "4.0.530a 5fe1dc6c",
                "X-UserId": "0f04d16a175c411e",
                "X-HomeGeographicRegion": "zh-Hans-CN",
                "X-ClientTraceId": clientId,
                "X-MT-Signature": signature,
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 Edg/127.0.0.0",
                "Content-Type": "application/json; charset=utf-8",
                "Content-Length": "0",
                "Accept-Encoding": "gzip"
            }
        });

        console.log("Status:", response.status);
        if (!response.ok) {
            console.log("Response:", await response.text());
        } else {
            const data = await response.json();
            console.log("Token received length:", data.t.length);
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

getEndpoint();