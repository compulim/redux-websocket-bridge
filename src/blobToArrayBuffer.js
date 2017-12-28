export default function blobToArrayBuffer(blob) {
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader();

    fileReader.onerror = function (event) {
      reject(event);
    };

    fileReader.onload = function () {
      resolve(this.result);
    };

    fileReader.readAsArrayBuffer(blob);
  });
}
