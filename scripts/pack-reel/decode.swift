// Reads a phone video into 1080 × 1920 JPEG frames, cropped to fill the screen and
// turned the way it was shot (macOS's own video tools, no ffmpeg needed).
//   swift decode.swift <video> <folder> <fps> <max seconds> → c-00000.jpg …
import AVFoundation
import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

let args = CommandLine.arguments
guard args.count == 5, let fps = Double(args[3]), let maxSeconds = Double(args[4]) else {
  print("usage: decode.swift video folder fps seconds")
  exit(1)
}
let width = 1080, height = 1920
let asset = AVURLAsset(url: URL(fileURLWithPath: args[1]))
let generator = AVAssetImageGenerator(asset: asset)
generator.appliesPreferredTrackTransform = true
generator.requestedTimeToleranceBefore = CMTime(value: 1, timescale: 60)
generator.requestedTimeToleranceAfter = CMTime(value: 1, timescale: 60)
let seconds = min(CMTimeGetSeconds(asset.duration), maxSeconds)
guard seconds > 0 else {
  print("no video in \(args[1])")
  exit(1)
}
let space = CGColorSpaceCreateDeviceRGB()
let count = Int(seconds * fps)
for i in 0..<count {
  let time = CMTime(seconds: Double(i) / fps, preferredTimescale: 600)
  guard let image = try? generator.copyCGImage(at: time, actualTime: nil) else { continue }
  guard let context = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0, space: space, bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue) else { continue }
  // fill the screen, cropping whatever sticks out
  let scale = max(Double(width) / Double(image.width), Double(height) / Double(image.height))
  let w = Double(image.width) * scale, h = Double(image.height) * scale
  context.interpolationQuality = .high
  context.draw(image, in: CGRect(x: (Double(width) - w) / 2, y: (Double(height) - h) / 2, width: w, height: h))
  guard let frame = context.makeImage() else { continue }
  let url = URL(fileURLWithPath: args[2]).appendingPathComponent(String(format: "c-%05d.jpg", i)) as CFURL
  guard let out = CGImageDestinationCreateWithURL(url, UTType.jpeg.identifier as CFString, 1, nil) else { continue }
  CGImageDestinationAddImage(out, frame, [kCGImageDestinationLossyCompressionQuality: 0.85] as CFDictionary)
  CGImageDestinationFinalize(out)
}
