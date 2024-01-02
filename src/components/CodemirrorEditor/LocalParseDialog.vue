<template>
  <el-dialog
    title="解析本地 .md"
    class="parse_dialog"
    width="75%"
    :visible="visible"
    @close="$emit('close')"
  >
    <el-row style="display: flex; margin-bottom: 16px">
      <el-button type="primary" @click="openFolder" plain>选择文件夹</el-button>
      <div style="align-self: center; margin-left: auto">
        支持解析并复制文件夹内的本地图片到微信公众号编辑器
      </div>
    </el-row>

    <el-row
      v-for="item in mdFileHandles"
      :key="item.path"
      style="display: flex; align-items: center; margin-bottom: 10px"
    >
      <div>{{ item.path }}</div>
      <el-button
        type="primary"
        @click="parseMarkdown(item, files)"
        style="margin-left: auto"
        plain
        >解析</el-button
      >
    </el-row>
  </el-dialog>
</template>

<script>
import {
  normalizeRelativePath,
  resolveUrlPath,
  isHttpUrl,
} from '@/assets/scripts/util'

/**
 * @returns {Promise<{ path: string, file: File }[]>}
 * @param {FileSystemDirectoryHandle} root
 */
async function getFileStructure(root) {
  const result = []

  async function readDirectory(directoryHandle, path = ``) {
    const files = []
    for await (const [name, handle] of directoryHandle.entries()) {
      if (handle.kind === `directory`) {
        files.push(...(await readDirectory(handle, `${path}${name}/`)))
      } else {
        files.push({
          path: `${path}${name}`,
          file: await handle.getFile(),
        })
      }
    }
    return files
  }

  const files = await readDirectory(root)
  result.push(...files)

  return result
}

export default {
  props: {
    visible: {
      type: Boolean,
      default: false,
    },
  },
  data: function () {
    return {
      mdFileHandles: [],
      files: [],
    }
  },
  methods: {
    async openFolder() {
      /**
       * The directory handle for the `md` directory. (root of md file)
       * @type {FileSystemDirectoryHandle}
       */
      const mdFileDirHandle = await window.showDirectoryPicker()

      // TODO list all .md files on UI
      // get all .md file under the mdFileDirHandle
      const mdFileResults = []
      let result = await getFileStructure(mdFileDirHandle)
      for (const item of result) {
        if (item.path.endsWith(`.md`)) {
          mdFileResults.push(item)
        }
      }

      this.mdFileHandles = mdFileResults
      this.files = result
    },

    async parseMarkdown(mdFileAndPath, result) {
      // pick one .md file to parse, get all the image file urls
      // const mdFileHandle = mdFileHandles[0]
      const mdFile = mdFileAndPath.file
      let mdFileText = await mdFile.text()

      // find all the image urls
      let originImageUrls = []
      const imageRegex = /!\[.*?\]\((.*?)\)/g
      let match = imageRegex.exec(mdFileText)
      while (match) {
        originImageUrls.push(match[1])
        match = imageRegex.exec(mdFileText)
      }

      // image fs url and relative url of Origin md file
      let originLocalImageUrls = [...originImageUrls]
      originLocalImageUrls = originLocalImageUrls
        .map(decodeURI)
        .filter((url) => !isHttpUrl(url))
        .map(normalizeRelativePath)
        .map((url) => {
          // remove the file name to get the base path
          let basePath = mdFileAndPath.path.split(`/`)
          if (basePath.length > 1) {
            basePath.pop()
          } else if (basePath.length === 1) {
            basePath = []
          }
          basePath = basePath.join(`/`)

          let fsUrl = resolveUrlPath(basePath, url)

          return {
            originUrl: url,
            fsUrl,
          }
        })

      // get image handles based on the image urls
      const mdImageFileHandles = result.filter((item) =>
        originLocalImageUrls.some((url) => url.fsUrl === item.path)
      )

      // md.str to replace ](str) to ](decodeURI(str)), in order to replace later
      mdFileText = mdFileText.replace(/!\[(.*?)\]\((.*?)\)/gm, (_, p1, p2) => {
        p2 = decodeURI(normalizeRelativePath(p2))
        return `![${p1}](${p2})`
      })

      // find imageUrls in mdImageFileHandles
      let urlsShouldBeReplaced = [] // {originUrl, resultUrl}
      for (const imageUrl of originLocalImageUrls) {
        let mdImageFileHandle = mdImageFileHandles.find((item) => {
          return item.path === imageUrl.fsUrl
        })
        if (!mdImageFileHandle) {
          continue
        }

        // get the file
        const imageFile = mdImageFileHandle.file
        // generate object url
        const fsImageFileObjUrl = URL.createObjectURL(imageFile)

        urlsShouldBeReplaced.push({
          originUrl: imageUrl.originUrl,
          resultUrl: fsImageFileObjUrl,
        })
      }

      // replace mdFileText
      let resultMdFileText = mdFileText
      for (const replaceItem of urlsShouldBeReplaced) {
        resultMdFileText = resultMdFileText.replace(
          `](${replaceItem.originUrl})`,
          `](${replaceItem.resultUrl})`
        )
      }

      this.$emit(`parsed`, resultMdFileText)
      this.$emit(`close`)
    },
  },
}
</script>
