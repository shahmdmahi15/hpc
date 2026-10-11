# HPC Waiting Room Display — Native Android TV API Specification

This documentation provides the official and complete technical guide for building a **100% custom native Android TV application** (Kotlin / Jetpack Compose / Leanback) for the **Health & Pain Care Center (HPC)** waiting room display system.

---

## Table of Contents
1. [Architecture Overview](#1-architecture-overview)
2. [Zero-Configuration LAN Auto-Discovery](#2-zero-configuration-lan-auto-discovery)
   - [UDP Broadcast Protocol (Port 8888)](#udp-broadcast-protocol-port-8888)
   - [Kotlin Implementation Example](#kotlin-udp-discovery-implementation)
   - [HTTP Discovery Manifest Endpoint](#http-discovery-manifest-endpoint)
3. [Local SSL Certificate Setup & Pinning](#3-local-ssl-certificate-setup--pinning)
   - [Bundling Root CA](#bundling-root-ca)
   - [Android Network Security Config](#android-network-security-config)
   - [OkHttpClient Custom TrustManager](#okhttpclient-custom-trustmanager)
4. [Waiting Room Snapshot API](#4-waiting-room-snapshot-api)
   - [Endpoint Specification](#endpoint-specification)
   - [JSON Response Structure](#json-response-structure)
   - [Kotlin Data Models (Kotlinx Serialization)](#kotlin-data-models)
5. [Real-Time Server-Sent Events (SSE) Stream](#5-real-time-server-sent-events-sse-stream)
   - [Stream Specification](#stream-specification)
   - [Event Types & Payloads](#event-types--payloads)
   - [Kotlin OkHttp EventSource Implementation](#kotlin-okhttp-eventsource-implementation)
6. [Hardware Telemetry & Heartbeat API](#6-hardware-telemetry--heartbeat-api)
   - [Heartbeat Endpoint Specification](#heartbeat-endpoint-specification)
   - [Background Telemetry Worker in Kotlin](#background-telemetry-worker-in-kotlin)
7. [Android TV Audio & Leanback Best Practices](#7-android-tv-audio--leanback-best-practices)
   - [Chime Audio & Dual-Language TTS](#chime-audio--dual-language-tts)
   - [Screen Wake Lock (`FLAG_KEEP_SCREEN_ON`)](#screen-wake-lock)
8. [CLI Testing Commands (cURL / Netcat)](#8-cli-testing-commands-curl--netcat)

---

## 1. Architecture Overview

The HPC Waiting Room Display system provides a hybrid communication pipeline:
* **UDP Discovery (Port 8888)**: The Android TV app automatically locates the clinic server on the local Wi-Fi/LAN without requiring the user to type an IP address.
* **REST Snapshot (`/api/v1/tv/waiting-room`)**: Delivers the immediate state upon application launch (active patient calls, doctor consultation queue, 15 therapy room countdown timers, active bulletin notices, clinic metadata).
* **SSE Real-Time Stream (`/api/v1/tv/waiting-room/stream`)**: Pushes instant events (doctor calling patients with pre-rendered English and Bangla voice announcements, queue status transitions, bulletin notice updates, and emergency alerts).
* **Fleet Telemetry (`/api/network/heartbeat`)**: Periodically registers the Android TV terminal in the clinic's Admin Network Management dashboard (`/admin/network`), allowing administrators to monitor live ping, LAN IP, and connectivity health.

```
┌────────────────────────────────────────────────────────┐
│             Android TV (Kotlin / Compose)              │
└──────┬──────────────────────┬───────────────────▲──────┘
       │ UDP Broadcast (8888) │                   │
       ▼                      ▼                   │ SSE Stream
┌─────────────────────────────────────────────────┴──────┐
│                  HPC Clinic Server                     │
│  - UDP Responder (Port 8888)                           │
│  - REST API Engine (Snapshot & Heartbeat)              │
│  - Realtime Event Bus (WAL SQLite & In-Memory SSE)     │
└────────────────────────────────────────────────────────┘
```

---

## 2. Zero-Configuration LAN Auto-Discovery

### UDP Broadcast Protocol (Port 8888)
When the Android TV application starts, it broadcasts a UDP packet to port `8888` on the local subnet. The server automatically replies with its local IP, port, SSL status, and clinic name.

* **Transport**: UDP IPv4
* **Target Address**: `255.255.255.255` (or subnet broadcast e.g. `192.168.1.255`)
* **Target Port**: `8888`
* **Outgoing Payload**:
  ```text
  HPC_DISCOVER_SERVER
  ```
  *(or `HPC_PING`)*

* **Server Response Payload (JSON)**:
  ```json
  {
    "service": "hpc-clinic-server",
    "ip": "192.168.1.100",
    "port": 3000,
    "ssl": true,
    "name": "Health Peak Center"
  }
  ```

### Kotlin UDP Discovery Implementation

```kotlin
package com.hpc.tv.discovery

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress

@Serializable
data class DiscoveredServer(
    val service: String,
    val ip: String,
    val port: Int,
    val ssl: Boolean,
    val name: String
) {
    val baseUrl: String
        get() = "${if (ssl) "https" else "http"}://$ip:$port"
}

object ServerDiscoveryManager {
    private const val UDP_PORT = 8888
    private const val DISCOVER_MSG = "HPC_DISCOVER_SERVER"
    private const val BUFFER_SIZE = 1024
    private val json = Json { ignoreUnknownKeys = true }

    suspend fun discoverServer(timeoutMs: Long = 4000): DiscoveredServer? = withContext(Dispatchers.IO) {
        withTimeoutOrNull(timeoutMs) {
            var socket: DatagramSocket? = null
            try {
                socket = DatagramSocket().apply {
                    broadcast = true
                    soTimeout = timeoutMs.toInt()
                }

                val sendData = DISCOVER_MSG.toByteArray(Charsets.UTF_8)
                val broadcastAddr = InetAddress.getByName("255.255.255.255")
                val sendPacket = DatagramPacket(sendData, sendData.size, broadcastAddr, UDP_PORT)
                socket.send(sendPacket)

                val receiveBuf = ByteArray(BUFFER_SIZE)
                val receivePacket = DatagramPacket(receiveBuf, receiveBuf.size)
                socket.receive(receivePacket)

                val responseString = String(receivePacket.data, 0, receivePacket.length, Charsets.UTF_8).trim()
                json.decodeFromString<DiscoveredServer>(responseString)
            } catch (e: Exception) {
                null
            } finally {
                socket?.close()
            }
        }
    }
}
```

### HTTP Discovery Manifest Endpoint
If the Android TV already knows the server IP or uses manual entry as a fallback, it can verify the service identity via HTTP:

* **Endpoint**: `GET /api/v1/tv/discovery`
* **Response `(200 OK)`**:
  ```json
  {
    "service": "hpc-clinic-server",
    "version": "1.0",
    "name": "Health Peak Center",
    "port": 3000,
    "ssl": true,
    "endpoints": {
      "snapshot": "/api/v1/tv/waiting-room",
      "stream": "/api/v1/tv/waiting-room/stream",
      "heartbeat": "/api/network/heartbeat"
    }
  }
  ```

---

## 3. Local SSL Certificate Setup & Pinning

The HPC Clinic Server uses an internal root Certificate Authority (`rootCA.crt`) for offline local HTTPS across the clinic's local network.

### Bundling Root CA
Download the clinic's Root CA from the server:
```bash
curl -k -o root_ca.crt https://<SERVER_IP>:3000/rootCA.crt
```
Place this certificate file in your Android project under:
`app/src/main/res/raw/root_ca.crt`

### Android Network Security Config
Create `app/src/main/res/xml/network_security_config.xml`:
```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <!-- Trust Android system CAs -->
            <certificates src="system" />
            <!-- Trust the Clinic's bundled root CA -->
            <certificates src="@raw/root_ca" />
        </trust-anchors>
    </base-config>
</network-security-config>
```

Reference it in your `app/src/main/AndroidManifest.xml`:
```xml
<application
    android:networkSecurityConfig="@xml/network_security_config"
    ... >
</application>
```

### OkHttpClient Custom TrustManager
For dynamic IP connections, configure OkHttpClient with the bundled certificate:

```kotlin
package com.hpc.tv.network

import android.content.Context
import com.hpc.tv.R
import okhttp3.OkHttpClient
import java.security.KeyStore
import java.security.cert.CertificateFactory
import java.security.cert.X509Certificate
import java.util.concurrent.TimeUnit
import javax.net.ssl.SSLContext
import javax.net.ssl.TrustManagerFactory
import javax.net.ssl.X509TrustManager

object NetworkClientProvider {
    fun createOkHttpClient(context: Context): OkHttpClient {
        val cf = CertificateFactory.getInstance("X.509")
        val caInput = context.resources.openRawResource(R.raw.root_ca)
        val ca: X509Certificate = caInput.use { cf.generateCertificate(it) as X509Certificate }

        val keyStore = KeyStore.getInstance(KeyStore.getDefaultType()).apply {
            load(null, null)
            setCertificateEntry("hpc_root_ca", ca)
        }

        val tmf = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm()).apply {
            init(keyStore)
        }

        val trustManagers = tmf.trustManagers
        val x509TrustManager = trustManagers[0] as X509TrustManager

        val sslContext = SSLContext.getInstance("TLS").apply {
            init(null, trustManagers, null)
        }

        return OkHttpClient.Builder()
            .sslSocketFactory(sslContext.socketFactory, x509TrustManager)
            .hostnameVerifier { _, _ -> true } // Allow LAN IP hostname match with SAN
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(0, TimeUnit.SECONDS) // Read timeout 0 is required for SSE streaming
            .retryOnConnectionFailure(true)
            .build()
    }
}
```

---

## 4. Waiting Room Snapshot API

Fetches the complete current state of the clinic on application startup or manual refresh.

### Endpoint Specification
* **URL**: `GET /api/v1/tv/waiting-room`
* **Headers**:
  * `Accept: application/json`
  * `Cache-Control: no-cache`
* **CORS**: `Access-Control-Allow-Origin: *`

### JSON Response Structure

```json
{
  "clinic": {
    "name": "HEALTH & PAIN CARE CENTER",
    "nameBangla": "হেলথ অ্যান্ড পেইন কেয়ার সেন্টার",
    "branch": "Chanchra Dalmill (Opposite Police Outpost), Sadar, Jashore - 7400",
    "addressBangla": "চাঁচড়া ডালমিল (পুলিশ ফাঁড়ির বিপরীতে), সদর, যশোর-৭৪০০",
    "phone": "01822-000035",
    "hotline": "01822-000035",
    "logoUrl": "/icon.png",
    "serverTime": "2026-10-11T16:15:00.000Z"
  },
  "activeCalls": [
    {
      "appointmentId": "cmv12345678",
      "serialNumber": 12,
      "patientName": "Shah Md. Mahi",
      "patientMrn": "HPC-2026-0001",
      "gender": "MALE",
      "roomNumber": "101",
      "roomPurpose": "Doctor Consultation",
      "station": "CONSULTATION_ROOM",
      "calledAt": "2026-10-11T16:14:30.000Z",
      "sound": "chime",
      "voiceBn": "দয়া করে মনোযোগ দিন। টোকেন নম্বর ১২। রোগী Shah Md. Mahi, রুম নম্বর ১০১-এ আসুন।",
      "voiceEn": "Attention please. Token 12. Patient Shah Md. Mahi. Please proceed to Room 101."
    }
  ],
  "consultationQueue": {
    "doctors": [
      {
        "doctorId": "usr_doc_01",
        "doctorName": "Dr. Sarah Ahmed",
        "roomNumber": "101",
        "roomPurpose": "Doctor Consultation",
        "currentlyServing": {
          "appointmentId": "cmv12345678",
          "serialNumber": 12,
          "patientName": "Shah Md. Mahi",
          "status": "CALLING",
          "startedAt": "2026-10-11T16:14:30.000Z"
        },
        "waitingCount": 3,
        "waitingSerials": [
          {
            "appointmentId": "cmv98765432",
            "serialNumber": 13,
            "patientName": "Fatema Begum",
            "checkInTime": "2026-10-11T15:45:00.000Z",
            "toldTime": "11:30 AM"
          }
        ]
      }
    ],
    "currentlyServing": [
      {
        "doctorId": "usr_doc_01",
        "doctorName": "Dr. Sarah Ahmed",
        "roomNumber": "101",
        "serialNumber": 12,
        "patientName": "Shah Md. Mahi"
      }
    ],
    "waitingQueue": [
      {
        "appointmentId": "cmv98765432",
        "serialNumber": 13,
        "patientName": "Fatema Begum",
        "doctorName": "Dr. Sarah Ahmed",
        "checkInTime": "2026-10-11T15:45:00.000Z"
      }
    ],
    "totalWaiting": 1
  },
  "therapyQueue": {
    "rooms": [
      {
        "roomId": "room_207",
        "roomNumber": "207",
        "purpose": "Therapy Room",
        "status": "OCCUPIED",
        "currentPatient": {
          "appointmentId": "cmv55667788",
          "serialNumber": 8,
          "patientName": "Anisur Rahman",
          "startedAt": "2026-10-11T16:05:00.000Z"
        },
        "timer": {
          "isRunning": true,
          "currentStepIndex": 0,
          "remainingSeconds": 540,
          "totalSeconds": 900,
          "modalityName": "Short Wave Diathermy (SWD)",
          "isAllCompleted": false
        }
      }
    ],
    "activeTherapyCount": 1,
    "waitingTherapyCount": 2,
    "estimatedWaitMinutes": 15,
    "waitingQueue": [
      {
        "appointmentId": "cmv11223344",
        "serialNumber": 9,
        "patientName": "Abdul Karim",
        "checkInTime": "2026-10-11T16:00:00.000Z",
        "toldTime": "11:45 AM"
      }
    ]
  },
  "bulletinNotices": [
    {
      "id": "not_101",
      "title": "ওয়েটিং রুম নোটিশ",
      "message": "সিরিয়াল ডাকা হলে অনুগ্রহ করে টোকেন টিকিটটি সাথে রাখুন।",
      "priority": "NORMAL",
      "targetAudience": "WAITING_ROOM",
      "createdAt": "2026-10-11T12:00:00.000Z"
    }
  ],
  "telemetry": {
    "version": "1.0",
    "mode": "production",
    "sseStreamUrl": "/api/v1/tv/waiting-room/stream",
    "serverTimestamp": 1728663300000
  }
}
```

### Kotlin Data Models

```kotlin
package com.hpc.tv.model

import kotlinx.serialization.Serializable

@Serializable
data class WaitingRoomSnapshot(
    val clinic: ClinicInfo,
    val activeCalls: List<CallAnnouncement> = emptyList(),
    val consultationQueue: ConsultationQueueData,
    val therapyQueue: TherapyQueueData,
    val bulletinNotices: List<BulletinNoticeItem> = emptyList(),
    val telemetry: TelemetryInfo
)

@Serializable
data class ClinicInfo(
    val name: String,
    val nameBangla: String,
    val branch: String,
    val addressBangla: String,
    val phone: String,
    val hotline: String,
    val logoUrl: String,
    val serverTime: String
)

@Serializable
data class CallAnnouncement(
    val appointmentId: String,
    val serialNumber: Int? = null,
    val patientName: String,
    val patientMrn: String? = null,
    val gender: String? = null,
    val roomNumber: String,
    val roomPurpose: String,
    val station: String,
    val calledAt: String,
    val sound: String = "chime",
    val voiceBn: String,
    val voiceEn: String
)

@Serializable
data class ConsultationQueueData(
    val doctors: List<DoctorChamberQueue> = emptyList(),
    val currentlyServing: List<CurrentlyServingPatient> = emptyList(),
    val waitingQueue: List<WaitingQueuePatient> = emptyList(),
    val totalWaiting: Int = 0
)

@Serializable
data class DoctorChamberQueue(
    val doctorId: String,
    val doctorName: String,
    val roomNumber: String,
    val roomPurpose: String,
    val currentlyServing: ServingStatus? = null,
    val waitingCount: Int = 0,
    val waitingSerials: List<WaitingSerialItem> = emptyList()
)

@Serializable
data class ServingStatus(
    val appointmentId: String? = null,
    val serialNumber: Int? = null,
    val patientName: String,
    val status: String,
    val startedAt: String? = null
)

@Serializable
data class WaitingSerialItem(
    val appointmentId: String? = null,
    val serialNumber: Int? = null,
    val patientName: String,
    val checkInTime: String? = null,
    val toldTime: String? = null
)

@Serializable
data class CurrentlyServingPatient(
    val doctorId: String,
    val doctorName: String,
    val roomNumber: String,
    val serialNumber: Int? = null,
    val patientName: String
)

@Serializable
data class WaitingQueuePatient(
    val appointmentId: String,
    val serialNumber: Int? = null,
    val patientName: String,
    val doctorName: String? = null,
    val checkInTime: String? = null
)

@Serializable
data class TherapyQueueData(
    val rooms: List<TherapyRoomState> = emptyList(),
    val activeTherapyCount: Int = 0,
    val waitingTherapyCount: Int = 0,
    val estimatedWaitMinutes: Int = 0,
    val waitingQueue: List<WaitingSerialItem> = emptyList()
)

@Serializable
data class TherapyRoomState(
    val roomId: String,
    val roomNumber: String,
    val purpose: String,
    val status: String,
    val currentPatient: CurrentTherapyPatient? = null,
    val timer: TherapyTimerInfo? = null
)

@Serializable
data class CurrentTherapyPatient(
    val appointmentId: String,
    val serialNumber: Int? = null,
    val patientName: String,
    val startedAt: String? = null
)

@Serializable
data class TherapyTimerInfo(
    val isRunning: Boolean,
    val currentStepIndex: Int,
    val remainingSeconds: Int,
    val totalSeconds: Int,
    val modalityName: String,
    val isAllCompleted: Boolean
)

@Serializable
data class BulletinNoticeItem(
    val id: String,
    val title: String? = null,
    val message: String,
    val priority: String, // LOW, NORMAL, HIGH, URGENT
    val targetAudience: String,
    val createdAt: String
)

@Serializable
data class TelemetryInfo(
    val version: String,
    val mode: String,
    val sseStreamUrl: String,
    val serverTimestamp: Long
)
```

---

## 5. Real-Time Server-Sent Events (SSE) Stream

### Stream Specification
* **URL**: `GET /api/v1/tv/waiting-room/stream`
* **Headers**:
  * `Accept: text/event-stream`
  * `Cache-Control: no-cache`
* **Keep-Alive**: Pushes `: heartbeat\n\n` comments and `PING` events every 15s to keep routers and proxies alive.

### Event Types & Payloads

| Event Name | Description | Payload Schema | Action Required by Android App |
| :--- | :--- | :--- | :--- |
| `INITIAL_STATE` | Complete initial snapshot on connection | Full `WaitingRoomSnapshot` JSON | Populate all UI cards and countdown timers |
| `DOCTOR_CALLED` | Doctor calls next patient from chamber | `CallAnnouncement` JSON | 1. Play bell chime<br>2. Show modal announcement popup<br>3. Play TTS (`voiceBn` then `voiceEn`) |
| `APPOINTMENT_UPDATED` | Queue position change or patient checkout | `{ eventType: String, data: Any, timestamp: String }` | Update queues or re-fetch snapshot |
| `BULLETIN_NOTICE_CREATED` / `UPDATED` / `DELETED` | Notice board change | `BulletinNoticeItem` JSON | Update the bottom running marquee ticker |
| `SYSTEM_BROADCAST_ALERT` | Urgent broadcast dispatched from Admin | `{ message: String, priority: String, sentBy: String }` | Show top emergency banner overlay with siren/alert tone |
| `PING` | LAN keepalive packet | `{ ts: Long }` | Update connection latency timestamp |

### Kotlin OkHttp EventSource Implementation

Add the OkHttp SSE dependency to `app/build.gradle.kts`:
```kotlin
implementation("com.squareup.okhttp3:okhttp:4.12.0")
implementation("com.squareup.okhttp3:okhttp-sse:4.12.0")
```

Connect and observe events in Kotlin:

```kotlin
package com.hpc.tv.realtime

import com.hpc.tv.model.CallAnnouncement
import com.hpc.tv.model.WaitingRoomSnapshot
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.sse.EventSource
import okhttp3.sse.EventSourceListener
import okhttp3.sse.EventSources

class WaitingRoomSseClient(
    private val client: OkHttpClient,
    private val baseUrl: String
) {
    private val json = Json { ignoreUnknownKeys = true }
    private var eventSource: EventSource? = null

    val isConnected = MutableStateFlow(false)
    val snapshotState = MutableStateFlow<WaitingRoomSnapshot?>(null)

    // Flow for one-time sound announcements
    private val _callAnnouncementFlow = MutableSharedFlow<CallAnnouncement>(extraBufferCapacity = 5)
    val callAnnouncementFlow: SharedFlow<CallAnnouncement> = _callAnnouncementFlow

    fun connect() {
        disconnect()

        val request = Request.Builder()
            .url("$baseUrl/api/v1/tv/waiting-room/stream")
            .header("Accept", "text/event-stream")
            .header("Cache-Control", "no-cache")
            .build()

        val factory = EventSources.createFactory(client)
        eventSource = factory.newEventSource(request, object : EventSourceListener() {
            override fun onOpen(eventSource: EventSource, response: Response) {
                isConnected.value = true
            }

            override fun onEvent(eventSource: EventSource, id: String?, type: String?, data: String) {
                when (type) {
                    "INITIAL_STATE" -> {
                        try {
                            val snapshot = json.decodeFromString<WaitingRoomSnapshot>(data)
                            snapshotState.value = snapshot
                        } catch (e: Exception) {
                            e.printStackTrace()
                        }
                    }
                    "DOCTOR_CALLED" -> {
                        try {
                            val announcement = json.decodeFromString<CallAnnouncement>(data)
                            _callAnnouncementFlow.tryEmit(announcement)
                        } catch (e: Exception) {
                            e.printStackTrace()
                        }
                    }
                    "BULLETIN_NOTICE_CREATED", "BULLETIN_NOTICE_UPDATED", "BULLETIN_NOTICE_DELETED" -> {
                        // Notice modified: reload or update notices list
                    }
                    "SYSTEM_BROADCAST_ALERT" -> {
                        // Handle urgent emergency marquee or banner
                    }
                    "APPOINTMENT_UPDATED" -> {
                        // Queue changed: state sync
                    }
                }
            }

            override fun onClosed(eventSource: EventSource) {
                isConnected.value = false
            }

            override fun onFailure(eventSource: EventSource, t: Throwable?, response: Response?) {
                isConnected.value = false
                // Implement exponential retry backoff here
            }
        })
    }

    fun disconnect() {
        eventSource?.cancel()
        eventSource = null
        isConnected.value = false
    }
}
```

---

## 6. Hardware Telemetry & Heartbeat API

The Android TV terminal should report its live status back to the server every 10–15 seconds. This registers the TV in the clinic's **Admin Fleet Dashboard** (`/admin/network`) so sysadmins can track device health, LAN IP, and connection ping.

### Heartbeat Endpoint Specification
* **URL**: `POST /api/network/heartbeat`
* **Content-Type**: `application/json`
* **Request Body**:
  ```json
  {
    "deviceId": "android-tv-waiting-room-01",
    "deviceName": "Main Waiting Room Sony Bravia",
    "deviceType": "ANDROID_TV",
    "role": "WAITING_ROOM",
    "station": "Waiting Room TV",
    "latencyMs": 12,
    "clientTimestamp": 1728663300000,
    "browser": "AndroidTV/Native",
    "userAgent": "HPC-AndroidTV-Client/1.0"
  }
  ```

* **Response `(200 OK)`**:
  ```json
  {
    "status": "ok",
    "serverTimestamp": 1728663300012,
    "receivedIp": "192.168.1.105",
    "ok": true,
    "ipAddress": "192.168.1.105"
  }
  ```

### Background Telemetry Worker in Kotlin

```kotlin
package com.hpc.tv.telemetry

import android.os.Build
import kotlinx.coroutines.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

class TelemetryHeartbeatManager(
    private val client: OkHttpClient,
    private val baseUrl: String,
    private val deviceId: String
) {
    private var job: Job? = null
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    fun startHeartbeat() {
        job?.cancel()
        job = scope.launch {
            while (isActive) {
                sendHeartbeat()
                delay(12000) // Send every 12 seconds
            }
        }
    }

    fun stopHeartbeat() {
        job?.cancel()
    }

    private fun sendHeartbeat() {
        try {
            val startMs = System.currentTimeMillis()
            val payload = JSONObject().apply {
                put("deviceId", deviceId)
                put("deviceName", "${Build.MANUFACTURER} ${Build.MODEL}")
                put("deviceType", "ANDROID_TV")
                put("role", "WAITING_ROOM")
                put("station", "Waiting Room TV")
                put("clientTimestamp", startMs)
                put("userAgent", "HPC-AndroidTV/${Build.VERSION.RELEASE}")
            }

            val body = payload.toString().toRequestBody("application/json".toMediaType())
            val request = Request.Builder()
                .url("$baseUrl/api/network/heartbeat")
                .post(body)
                .build()

            client.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    val latency = System.currentTimeMillis() - startMs
                    // Latency recorded successfully
                }
            }
        } catch (e: Exception) {
            // Server offline or network transient error
        }
    }
}
```

---

## 7. Android TV Audio & Leanback Best Practices

### Chime Audio & Dual-Language TTS
When a `DOCTOR_CALLED` event arrives:
1. **Play Bell Chime**: Play a hospital bell tone (Ding-Dong chord, 523Hz then 392Hz) via `SoundPool` or `MediaPlayer`.
2. **Text-To-Speech (TTS)**:
   * The server provides pre-rendered voice strings:
     * `announcement.voiceBn`: `"দয়া করে মনোযোগ দিন। টোকেন নম্বর ১২। রোগী Shah Md. Mahi, রুম নম্বর ১০১-এ আসুন।"`
     * `announcement.voiceEn`: `"Attention please. Token 12. Patient Shah Md. Mahi. Please proceed to Room 101."`
   * Initialize Android `android.speech.tts.TextToSpeech`:
     * Speak `voiceBn` using locale `Locale("bn", "BD")`.
     * After completion, speak `voiceEn` using `Locale.US`.

```kotlin
// Android TextToSpeech sequencing example:
tts.setLanguage(Locale("bn", "BD"))
tts.speak(announcement.voiceBn, TextToSpeech.QUEUE_FLUSH, null, "call_bn")

// Set listener to queue English when Bengali completes:
tts.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
    override fun onDone(utteranceId: String?) {
        if (utteranceId == "call_bn") {
            tts.language = Locale.US
            tts.speak(announcement.voiceEn, TextToSpeech.QUEUE_ADD, null, "call_en")
        }
    }
    override fun onError(utteranceId: String?) {}
    override fun onStart(utteranceId: String?) {}
})
```

### Screen Wake Lock
To prevent the Android TV from going to sleep or activating a screensaver, set `FLAG_KEEP_SCREEN_ON` on the main `Activity`:

```kotlin
override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
}
```

---

## 8. CLI Testing Commands (cURL / Netcat)

You can verify all endpoints directly from your development machine:

### 1. Test UDP Discovery Broadcast
```bash
# Using socat or netcat to send UDP packet:
echo -n "HPC_DISCOVER_SERVER" | socat - UDP-DATAGRAM:255.255.255.255:8888,broadcast
```

### 2. Test Discovery Manifest
```bash
curl -k https://<SERVER_IP>:3000/api/v1/tv/discovery
```

### 3. Test Waiting Room Snapshot
```bash
curl -k -H "Accept: application/json" https://<SERVER_IP>:3000/api/v1/tv/waiting-room
```

### 4. Test SSE Real-Time Stream
```bash
curl -k -N -H "Accept: text/event-stream" https://<SERVER_IP>:3000/api/v1/tv/waiting-room/stream
```

### 5. Test Hardware Heartbeat
```bash
curl -k -X POST https://<SERVER_IP>:3000/api/network/heartbeat \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "test-terminal-01",
    "deviceName": "Test Terminal",
    "deviceType": "ANDROID_TV",
    "role": "WAITING_ROOM",
    "station": "Waiting Room TV",
    "latencyMs": 5
  }'
```

---

**Health & Pain Care Center (HPC)** • Internal Engineering Documentation • 2026
