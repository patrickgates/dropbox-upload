import { Dropbox } from 'dropbox';
import { FileChunker, prettyBytes } from './utils.mjs';
import * as core from '@actions/core'

const accessToken = core.getInput('dropbox_access_token')
const src = core.getInput('src')
const dest = core.getInput('dest')
const mode = core.getInput('mode')

const dropbox = new Dropbox({ accessToken: accessToken });

try {
  uploadStream(src, dest);
} catch (error) {
  if (error) {
    core.error(error)
  }
  core.setFailed(error)
}

async function uploadStream(filePath, dropboxFilePath) {
  core.info(`upload stream file '${filePath}' to '${dropboxFilePath}'`)

  const fileChunker = new FileChunker({ filePath, chunkSize: 10000000 })
  let contents = fileChunker.getNextChunk()

  const {result: fileUploadSession} = await dropbox.filesUploadSessionStart({ contents, close: false })

  let response
  while (true) {
    contents = fileChunker.getNextChunk()
    const offset = fileChunker.getLastChunkOffset()

    if (fileChunker.isFinished) {
      response = await dropbox.filesUploadSessionFinish({
        contents,
        cursor: { session_id: fileUploadSession.session_id, offset },
        commit: { path: dropboxFilePath, mode }
      })
      break
    }

    await dropbox.filesUploadSessionAppendV2({
      contents,
      cursor: { session_id: fileUploadSession.session_id, offset },
    })
    core.info(`uploaded ${prettyBytes(offset)}`)
  }

  core.info('upload stream finished')
  core.info(JSON.stringify(response))
  return response
}


