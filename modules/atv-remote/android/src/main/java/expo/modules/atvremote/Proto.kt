package expo.modules.atvremote

import java.io.ByteArrayOutputStream
import java.io.EOFException
import java.io.InputStream
import java.io.OutputStream

/**
 * Just enough protobuf to speak the Android TV Remote Service v2 protocol.
 *
 * The protocol only uses a dozen small messages, so hand-encoding the wire
 * format keeps protoc, a .proto source set, and a codegen step out of the
 * build entirely. Messages go over the socket length-delimited: a varint byte
 * count followed by the payload.
 */

const val WIRE_VARINT = 0
const val WIRE_LENGTH = 2

class ProtoWriter {
  private val out = ByteArrayOutputStream()

  /** proto3 leaves default values off the wire, so zeros are simply absent. */
  fun varint(field: Int, value: Long): ProtoWriter {
    if (value != 0L) {
      tag(field, WIRE_VARINT)
      writeVarint(out, value)
    }
    return this
  }

  fun varint(field: Int, value: Int): ProtoWriter = varint(field, value.toLong())

  fun bytes(field: Int, value: ByteArray): ProtoWriter {
    tag(field, WIRE_LENGTH)
    writeVarint(out, value.size.toLong())
    out.write(value)
    return this
  }

  fun string(field: Int, value: String): ProtoWriter =
    bytes(field, value.toByteArray(Charsets.UTF_8))

  /**
   * Nested messages are always written, even when they encode to nothing —
   * several of the protocol's acks are deliberately empty messages whose
   * presence is the entire signal.
   */
  fun message(field: Int, block: ProtoWriter.() -> Unit): ProtoWriter =
    bytes(field, ProtoWriter().apply(block).toByteArray())

  fun toByteArray(): ByteArray = out.toByteArray()

  private fun tag(field: Int, wire: Int) = writeVarint(out, ((field shl 3) or wire).toLong())
}

/** A decoded message as field number -> value. Repeats keep the last seen. */
class ProtoFields(
  private val varints: Map<Int, Long>,
  private val chunks: Map<Int, ByteArray>,
) {
  fun has(field: Int): Boolean = varints.containsKey(field) || chunks.containsKey(field)

  fun int(field: Int, fallback: Int = 0): Int = varints[field]?.toInt() ?: fallback

  fun bool(field: Int): Boolean = (varints[field] ?: 0L) != 0L

  fun str(field: Int): String? = chunks[field]?.toString(Charsets.UTF_8)

  fun nested(field: Int): ProtoFields? = chunks[field]?.let { parseProto(it) }
}

fun parseProto(bytes: ByteArray): ProtoFields {
  val varints = HashMap<Int, Long>()
  val chunks = HashMap<Int, ByteArray>()
  var pos = 0

  fun readVarintAt(): Long? {
    var value = 0L
    var shift = 0
    while (true) {
      if (pos >= bytes.size) return null
      val b = bytes[pos++].toInt() and 0xFF
      value = value or ((b and 0x7F).toLong() shl shift)
      if (b and 0x80 == 0) return value
      shift += 7
      if (shift > 63) return null
    }
  }

  while (pos < bytes.size) {
    val key = readVarintAt() ?: break
    val field = (key ushr 3).toInt()
    when ((key and 7L).toInt()) {
      WIRE_VARINT -> varints[field] = readVarintAt() ?: break
      WIRE_LENGTH -> {
        val len = readVarintAt() ?: break
        val stop = minOf(bytes.size.toLong(), pos.toLong() + len).toInt()
        chunks[field] = bytes.copyOfRange(pos, stop)
        pos = stop
      }
      1 -> pos += 8 // fixed64
      5 -> pos += 4 // fixed32
      else -> return ProtoFields(varints, chunks) // groups: not used here
    }
  }
  return ProtoFields(varints, chunks)
}

fun writeVarint(out: OutputStream, value: Long) {
  var v = value
  while (true) {
    val b = (v and 0x7FL).toInt()
    v = v ushr 7
    if (v == 0L) {
      out.write(b)
      return
    }
    out.write(b or 0x80)
  }
}

fun writeDelimited(out: OutputStream, payload: ByteArray) {
  writeVarint(out, payload.size.toLong())
  out.write(payload)
  out.flush()
}

fun readDelimited(input: InputStream): ByteArray {
  var len = 0L
  var shift = 0
  while (true) {
    val b = input.read()
    if (b < 0) throw EOFException("The TV closed the connection")
    len = len or ((b and 0x7F).toLong() shl shift)
    if (b and 0x80 == 0) break
    shift += 7
    if (shift > 35) throw EOFException("Malformed length prefix from the TV")
  }

  val buf = ByteArray(len.toInt())
  var read = 0
  while (read < buf.size) {
    val n = input.read(buf, read, buf.size - read)
    if (n < 0) throw EOFException("The TV closed the connection mid-message")
    read += n
  }
  return buf
}
