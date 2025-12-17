// VoiceLearn - Self-Hosted TTS Service
// OpenAI-compatible Text-to-Speech service for self-hosted servers
//
// Part of Services/TTS

import Foundation
import Logging
import AVFoundation

/// Self-hosted TTS service compatible with OpenAI TTS API format
///
/// Works with:
/// - Piper TTS server
/// - OpenedAI Speech
/// - Coqui TTS server
/// - VoiceLearn gateway TTS endpoint
/// - Any OpenAI-compatible TTS API
public actor SelfHostedTTSService: TTSService {

    // MARK: - Properties

    private let logger = Logger(label: "com.voicelearn.tts.selfhosted")
    private let baseURL: URL
    private let authToken: String?
    private let voiceId: String
    private let outputFormat: AudioFormat

    /// Performance metrics
    public private(set) var metrics: TTSMetrics = TTSMetrics(
        averageLatency: 0.1,
        averageCharactersPerSecond: 150
    )

    private var latencyValues: [TimeInterval] = []
    private var characterCounts: [Int] = []
    private var synthesisTimings: [TimeInterval] = []

    // MARK: - Initialization

    /// Initialize with explicit configuration
    /// - Parameters:
    ///   - baseURL: Base URL of the server (e.g., http://localhost:11402)
    ///   - voiceId: Voice identifier (depends on server)
    ///   - outputFormat: Desired audio format
    ///   - authToken: Optional authentication token
    public init(
        baseURL: URL,
        voiceId: String = "nova",
        outputFormat: AudioFormat = .wav,
        authToken: String? = nil
    ) {
        self.baseURL = baseURL
        self.voiceId = voiceId
        self.outputFormat = outputFormat
        self.authToken = authToken
        logger.info("SelfHostedTTSService initialized: \(baseURL.absoluteString)")
    }

    /// Initialize from ServerConfig
    public init?(server: ServerConfig, voiceId: String = "nova") {
        guard let baseURL = server.baseURL else {
            return nil
        }
        self.baseURL = baseURL
        self.voiceId = voiceId
        self.outputFormat = .wav
        self.authToken = nil
        logger.info("SelfHostedTTSService initialized from server config: \(server.name)")
    }

    /// Initialize with auto-discovery
    public init?() async {
        let serverManager = ServerConfigManager.shared
        let healthyServers = await serverManager.getHealthyTTSServers()

        guard let server = healthyServers.first,
              let baseURL = server.baseURL else {
            return nil
        }

        self.baseURL = baseURL
        self.voiceId = "nova"
        self.outputFormat = .wav
        self.authToken = nil
    }

    // MARK: - TTSService Protocol

    /// Synthesize text to audio data
    public func synthesize(text: String) async throws -> Data {
        let startTime = Date()

        // Build URL for speech endpoint
        let speechURL = baseURL.appendingPathComponent("v1/audio/speech")

        var request = URLRequest(url: speechURL)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        // Build request body (OpenAI-compatible format)
        let body: [String: Any] = [
            "model": "tts-1",  // Standard model identifier
            "input": text,
            "voice": voiceId,
            "response_format": outputFormat.rawValue
        ]

        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        // Make request
        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw TTSError.connectionFailed("Invalid response")
        }

        guard httpResponse.statusCode == 200 else {
            throw TTSError.connectionFailed("HTTP \(httpResponse.statusCode)")
        }

        // Update metrics
        let latency = Date().timeIntervalSince(startTime)
        latencyValues.append(latency)
        characterCounts.append(text.count)
        synthesisTimings.append(latency)
        updateMetrics()

        logger.debug("TTS synthesis complete: \(text.count) chars in \(String(format: "%.3f", latency))s")

        return data
    }

    /// Synthesize text to audio data with streaming
    public func synthesizeStreaming(text: String) -> AsyncStream<Data> {
        AsyncStream { continuation in
            Task {
                do {
                    // For non-streaming servers, synthesize the whole thing and yield once
                    let data = try await self.synthesize(text: text)
                    continuation.yield(data)
                    continuation.finish()
                } catch {
                    self.logger.error("Streaming synthesis failed: \(error.localizedDescription)")
                    continuation.finish()
                }
            }
        }
    }

    // MARK: - Health Check

    /// Check if the server is healthy
    public func checkHealth() async -> Bool {
        let healthURL = baseURL.appendingPathComponent("health")

        do {
            var request = URLRequest(url: healthURL)
            request.timeoutInterval = 5

            let (_, response) = try await URLSession.shared.data(for: request)

            if let httpResponse = response as? HTTPURLResponse,
               httpResponse.statusCode == 200 {
                return true
            }
        } catch {
            logger.warning("Health check failed: \(error.localizedDescription)")
        }

        return false
    }

    // MARK: - Voice Management

    /// List available voices (if server supports it)
    public func listVoices() async throws -> [VoiceInfo] {
        let voicesURL = baseURL.appendingPathComponent("v1/voices")

        do {
            let (data, response) = try await URLSession.shared.data(from: voicesURL)

            guard let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200 else {
                return defaultVoices
            }

            // Try to parse voice list
            if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let voices = json["voices"] as? [[String: Any]] {
                return voices.compactMap { voiceData -> VoiceInfo? in
                    guard let id = voiceData["id"] as? String ?? voiceData["voice_id"] as? String,
                          let name = voiceData["name"] as? String else {
                        return nil
                    }
                    return VoiceInfo(
                        id: id,
                        name: name,
                        language: voiceData["language"] as? String ?? "en",
                        gender: voiceData["gender"] as? String
                    )
                }
            }
        } catch {
            logger.debug("Could not list voices, using defaults")
        }

        return defaultVoices
    }

    private var defaultVoices: [VoiceInfo] {
        [
            VoiceInfo(id: "nova", name: "Nova", language: "en", gender: "female"),
            VoiceInfo(id: "alloy", name: "Alloy", language: "en", gender: "neutral"),
            VoiceInfo(id: "echo", name: "Echo", language: "en", gender: "male"),
            VoiceInfo(id: "fable", name: "Fable", language: "en", gender: "male"),
            VoiceInfo(id: "onyx", name: "Onyx", language: "en", gender: "male"),
            VoiceInfo(id: "shimmer", name: "Shimmer", language: "en", gender: "female")
        ]
    }

    // MARK: - Private Methods

    private func updateMetrics() {
        let avgLatency = latencyValues.isEmpty ? 0.1 : latencyValues.reduce(0, +) / Double(latencyValues.count)

        var avgCharsPerSecond: Double = 150
        if !characterCounts.isEmpty && !synthesisTimings.isEmpty {
            let totalChars = characterCounts.reduce(0, +)
            let totalTime = synthesisTimings.reduce(0, +)
            if totalTime > 0 {
                avgCharsPerSecond = Double(totalChars) / totalTime
            }
        }

        metrics = TTSMetrics(
            averageLatency: avgLatency,
            averageCharactersPerSecond: avgCharsPerSecond
        )
    }
}

// MARK: - Factory

extension SelfHostedTTSService {

    /// Create a service connected to local Piper server
    public static func piper(
        host: String = "localhost",
        port: Int = 11402,
        voice: String = "nova"
    ) -> SelfHostedTTSService {
        let url = URL(string: "http://\(host):\(port)")!
        return SelfHostedTTSService(baseURL: url, voiceId: voice)
    }

    /// Create a service connected to VoiceLearn gateway
    public static func voicelearnGateway(
        host: String = "localhost",
        port: Int = 11400,
        voice: String = "nova"
    ) -> SelfHostedTTSService {
        let url = URL(string: "http://\(host):\(port)")!
        return SelfHostedTTSService(baseURL: url, voiceId: voice)
    }

    /// Create a service from auto-discovered server
    public static func autoDiscover() async -> SelfHostedTTSService? {
        await SelfHostedTTSService()
    }
}

// MARK: - Supporting Types

/// Audio format for TTS output
public enum AudioFormat: String, Sendable {
    case wav = "wav"
    case mp3 = "mp3"
    case opus = "opus"
    case aac = "aac"
    case flac = "flac"
    case pcm = "pcm"
}

/// Information about a TTS voice
public struct VoiceInfo: Sendable, Identifiable {
    public let id: String
    public let name: String
    public let language: String
    public let gender: String?
}

/// TTS service metrics
public struct TTSMetrics: Sendable {
    public let averageLatency: TimeInterval
    public let averageCharactersPerSecond: Double
}

/// TTS service errors
public enum TTSError: Error, LocalizedError {
    case connectionFailed(String)
    case authenticationFailed
    case invalidInput
    case voiceNotFound(String)
    case serverError(String)

    public var errorDescription: String? {
        switch self {
        case .connectionFailed(let message): return "Connection failed: \(message)"
        case .authenticationFailed: return "Authentication failed"
        case .invalidInput: return "Invalid input text"
        case .voiceNotFound(let voice): return "Voice not found: \(voice)"
        case .serverError(let message): return "Server error: \(message)"
        }
    }
}
