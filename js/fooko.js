let audioContext;
let analyser;
let source;

let bufferLength;
let dataArray;

let eye_left_tf, eye_right_tf;
let mouth_open_tf;
let mouth_anime_frame = [0, 0, 0, 0, 0];

let $video = null;

$(function() {

  $('#mainArea').load('resource/fit_fooko.svg svg', function(e) {
    const $black_eye_left = SVG('#black_eye_left');
    const $black_eye_right = SVG('#black_eye_right');
    const $mouth_open = SVG('#mouth_open');

    eye_left_tf = $black_eye_left.transform();
    eye_right_tf = $black_eye_right.transform();
    mouth_open_tf = $mouth_open.transform();

    $('body').on('touchmove', function (e) {
      const x = e.touches[0].pageX;
      const y = e.touches[0].pageY;
      eyeMove(x, y);
    });

    $('#fooko').attr('width', '100%');
    $('#fooko').attr('height', '100%');

    // $(document).on('click touchstart', function() {
    $('#start').on('click touch', function() {
      audioContext = new AudioContext();
      analyser = audioContext.createAnalyser();
      analyser.minDecibels = -90; //最小値
      analyser.maxDecibels = 0; //最大値
      analyser.smoothingTimeConstant = 0.65;
      analyser.fftSize = 2048; //音域の数

      bufferLength = analyser.frequencyBinCount; //fftSizeの半分のサイズ
      dataArray = new Uint8Array(bufferLength); //波形データ格納用の配列を初期化
      analyser.getByteFrequencyData(dataArray); //周波数領域の波形データを取得

      navigator.mediaDevices.getUserMedia({ audio: true, video: { width: 1280, height: 720 } })
      .then(function(stream) {
        source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
      })
      .catch(function(err) { console.log(err.name + ": " + err.message); }); // always check for errors at the end.

      navigator.mediaDevices.getUserMedia({ audio: false, video: true })
      .then(function(stream) {
        $video = $('#video')[0];
        $video.srcObject = stream;
        $video.play();
        console.log($('#video'));
      })
      .catch(function(err) { console.log(err.name + ": " + err.message); }); // always check for errors at the end.


      main();
    });
  });
});

$(window).on('resize load', function () {
  console.log('resize');

  const bodyWidth = $('body').width();
  const bodyHeight = $('body').height();

  const whRate = bodyWidth / bodyHeight;

  const fookoWidth = 450;
  const fookoHeight = 730;

  const fookoRate = fookoWidth / fookoHeight;

  if (whRate > fookoRate) {
    const width = bodyHeight * fookoRate;
    const height = '100%';
    $('#mainArea').css('width', width);
    $('#mainArea').css('height', height);
  } else {
    const width = '100%';
    const height = bodyWidth / fookoRate;
    $('#mainArea').css('width', width);
    $('#mainArea').css('height', height);
  }
});

const main = function() {
  analyser.getByteFrequencyData(dataArray);

  const vowel = getVowel(dataArray);

  if($video != null) {
    faceRecognition();
  }

  mouthAnimate(vowel);

  requestAnimationFrame(main);
}

const imageSize = 50;
let patternSize;

const faceRecognition = function() {
  const ctx = $('#face')[0].getContext('2d');
  ctx.drawImage($video, 400, 120, 480, 480, 0, 0, imageSize, imageSize);

  const imageData = ctx.getImageData(0, 0, imageSize, imageSize);
  const originalData = getImageDataData(imageData);
  const grayData = getGrayImageDataData(imageData);
  setImageDataData(imageData, grayData);

  // const pattern = getTateFacePattern();
  // const pattern = getYokoFacePattern();
  // addPatternImage(imageData, pattern);

  ctx.putImageData(imageData, 0, 0);

  // setImageDataData(imageData, originalData);

  // console.log(imageData.data);

  let basePatternSize = 12;

  const sizeNum = 4;
  let bestScore = [];
  let bestX = [];
  let bestY = [];
  let use = [];

  for(let i = 0; i< sizeNum; i++) {
    bestScore.push(1000000000);
    bestX.push(0);
    bestY.push(0);
    use.push(true);
  }

  for(let i = 0; i < sizeNum; i++) {
    patternSize = basePatternSize + i * 3;
    const tatePattern = getTateFacePattern();
    const yokoPattern = getYokoFacePattern();
    for(let shiftY = 0; shiftY + patternSize <= imageSize; shiftY++) {
      for(let shiftX = 0; shiftX + patternSize <= imageSize; shiftX++) {
        if(!isFaceArea(imageData, {x: shiftX, y: shiftY})) {
          continue;
        }
        const tateScore = getTateFaceScore(imageData, tatePattern, {x: shiftX, y: shiftY});
        const yokoScore = getYokoFaceScore(imageData, yokoPattern, {x: shiftX, y: shiftY});
        const totalScore = tateScore * tateScore + yokoScore * yokoScore;
        if(totalScore < bestScore[i]) {
          bestScore[i] = totalScore;
          bestX[i] = shiftX;
          bestY[i] = shiftY;
        }
      }
    }
  }

  // console.log(bestX + ", " + bestY);

  let bestXSum = 0, bestYSum = 0;
  for(let my = 0; my< sizeNum; my++) {
    bestXSum = 0;
    bestYSum = 0;
    for(let other = 0; other< sizeNum; other++) {
      if(my == other) {
        continue;
      }
      const otherCenter = (basePatternSize + other * 3) / 2;
      bestXSum += bestX[other] + otherCenter;
      bestYSum += bestY[other] + otherCenter;
    }

    bestXSum /= sizeNum-1;
    bestYSum /= sizeNum-1;

    const myCenter = (basePatternSize + my * 3) / 2;
    if(Math.pow(bestX[my] + myCenter - bestXSum, 2) + Math.pow(bestY[my] + myCenter - bestYSum, 2) > 12*12) {
      use[my] = false;
    }
  }

  bestXSum = 0;
  bestYSum = 0;

  let bestNum = 0;

  for(let i = 0; i< sizeNum; i++) {
    if(use[i]) {
      ctx.strokeStyle  = "#ff0000";
      bestXSum += bestX[i];
      bestYSum += bestY[i];
      bestNum += 1;
    } else {
      ctx.strokeStyle  = "#ff00ff";
    }
    ctx.strokeRect(bestX[i], bestY[i], basePatternSize + i * 3, basePatternSize + i * 3);
  }
  ctx.strokeStyle  = "#0000ff";
  ctx.strokeRect(bestXSum/bestNum, bestYSum/bestNum, basePatternSize + (sizeNum/2) * 3, basePatternSize + (sizeNum/2) * 3);
  // ctx.putImageData(imageData, 0, 0);
}

const setImageDataData = function(imageData, data) {
  for(let y = 0; y < imageData.height; y++) {
    for(let x = 0; x < imageData.width; x++) {
      const offset = (imageData.width * 4 * y) + (4 * x);
      imageData.data[offset + 0] = data[offset + 0];
      imageData.data[offset + 1] = data[offset + 1];
      imageData.data[offset + 2] = data[offset + 2];
      imageData.data[offset + 3] = data[offset + 3];
    }
  }
}

const getImageDataData = function(imageData) {
  const data = [];
  Object.assign(data , imageData.data);

  return data;
}

const addPatternImage = function(imageData, pattern) {
  for(let y = 0; y < patternSize; y++) {
    for(let x = 0; x < patternSize; x++) {
      const offset = (imageData.width * 4 * y) + (4 * x);
      const r = imageData.data[offset + 0];
      const g = imageData.data[offset + 1];
      const b = imageData.data[offset + 2];
      let gray = (r + g + b) / 3;

      if(pattern[y][x] == 1) {
        gray -= gray * 0.25;
      } else if(pattern[y][x] == 0){
        gray += (255 - gray) * 0.25;
      }

      imageData.data[offset + 0] = gray;
      imageData.data[offset + 1] = gray;
      imageData.data[offset + 2] = gray;
      imageData.data[offset + 3] = 255;
    }
  }
}

const getGrayImage = function(imageData) {
  const grayImage = [];

  for(let y = 0; y < imageSize; y++) {
    const retsu = [];

    for(let x = 0; x < imageSize; x++) {
      const offset = (imageSize * 4 * y) + (4 * x);
      const r = imageData[offset + 0];
      const g = imageData[offset + 1];
      const b = imageData[offset + 2];

      retsu.push((r + g + b) / 3);
    }

    grayImage.push(retsu);
  }

  return grayImage;
}

const getGrayImageDataData = function(imageData) {
  const data = [];

  for(let y = 0; y < imageData.height; y++) {
    for(let x = 0; x < imageData.width; x++) {
      const offset = (imageData.width * 4 * y) + (4 * x);
      const r = imageData.data[offset + 0];
      const g = imageData.data[offset + 1];
      const b = imageData.data[offset + 2];
      let  gray = (r + g + b) / 3;
      gray = (gray - 120) * 1.5 + 120;

      data.push(gray);
      data.push(gray);
      data.push(gray);
      data.push(255);
    }
  }

  return data;
}

const isFaceArea = function(imageData, shiftPos) {
  let sum = 0;

  for(let y = 0; y < patternSize; y++) {
    for(let x = 0; x < patternSize; x++) {
      const offset = (4 * imageData.width * (y + shiftPos.y)) + (4 * (x + shiftPos.x));
      let gray = imageData.data[offset + 0];

      sum += gray;
    }
  }

  const average = sum / (patternSize * patternSize);

  if(shiftPos.x == 7 && shiftPos.y == 7) {
    console.log(average);
  }

  return (average >= 40);
}

const getTateFaceScore = function(imageData, pattern, shiftPos) {
  const targetImage = [];

  for(let y = 0; y < patternSize; y++) {
    const retsu = [];
    for(let x = 0; x < patternSize; x++) {
      const offset = (4 * imageData.width * (y + shiftPos.y)) + (4 * (x + shiftPos.x));
      let gray = imageData.data[offset + 0];

      if(pattern[y][x] == 1) {
        gray -= gray * 0.25;
      } else if(pattern[y][x] == 0){
        gray += (255 - gray) * 0.25;
      } else {
        gray = null;
      }

      retsu.push(gray);
    }
    targetImage.push(retsu);
  }

  const num = [0, 0, 0];
  const sum = [0, 0, 0];
  const average = [0, 0, 0];

  for(let y = 0; y < patternSize; y++) {
    for(let x = 0; x < patternSize; x++) {
      let group;
      if(x < patternSize/3*1) {
        group = 0;
      } else if(x < patternSize/3*2) {
        group = 1;
      } else {
        group = 2;
      }
      num[group] += 1;
      sum[group] += targetImage[y][x];
    }
  }

  average[0] = sum[0] / num[0];
  average[1] = sum[1] / num[1];
  average[2] = sum[2] / num[2];

  if(average[0] < 90 || average[2] < 90) {
    return 10000;
  }
  if(average[1] < 50) {
    return 10000;
  }


  let score = 0;
  score += Math.pow(average[0] - average[1], 2);
  score += Math.pow(average[2] - average[1], 2);

  if(shiftPos.x == 30 && shiftPos.y == 30) {
    // console.log(average);
  }

  return score;
}

const getYokoFaceScore = function(imageData, pattern, shiftPos) {
  const targetImage = [];

  for(let y = 0; y < patternSize; y++) {
    const retsu = [];
    for(let x = 0; x < patternSize; x++) {
      const offset = (4 * imageData.width * (y + shiftPos.y)) + (4 * (x + shiftPos.x));
      let gray = imageData.data[offset + 0];

      if(pattern[y][x] == 1) {
        gray -= gray * 0.25;
      } else if(pattern[y][x] == 0){
        gray += (255 - gray) * 0.25;
      } else {
        gray = -1;
      }

      retsu.push(gray);
    }
    targetImage.push(retsu);
  }

  const num = [0, 0, 0, 0];
  const sum = [0, 0, 0, 0];
  const average = [0, 0, 0, 0];

  for(let y = 0; y < patternSize; y++) {
    for(let x = 0; x < patternSize; x++) {
      if(targetImage[y][x] == -1) {
        continue;
      }

      let group;
      if(y < patternSize/3*1) {
        if(x < patternSize/3*1) {
          num[0] += 1;
          sum[0] += targetImage[y][x];
        }
        if(x >= patternSize/3*2) {
          num[1] += 1;
          sum[1] += targetImage[y][x];
        }
      } else if(y < patternSize/3*2) {
        if(x < patternSize/3*1) {
          num[2] += 1;
          sum[2] += targetImage[y][x];
        }
        if(x >= patternSize/3*2) {
          num[3] += 1;
          sum[3] += targetImage[y][x];
        }
      }
    }
  }

  average[0] = sum[0] / num[0];
  average[1] = sum[1] / num[1];
  average[2] = sum[2] / num[2];
  average[3] = sum[3] / num[3];

  if(average[0] < 90 || average[2] < 90) {
    return 10000;
  }
  if(average[1] < 50 || average[3] < 50) {
    return 10000;
  }

  let score = 0;
  score += Math.pow(average[0] - average[1], 2);
  score += Math.pow(average[2] - average[3], 2);

  if(shiftPos.x == 30 && shiftPos.y == 30) {
    // console.log(score);
  }

  return score;
}

const getTateFacePattern = function() {
  const pattern = [];

  for(let y = 0; y < patternSize; y++) {
    const retsu = [];
    for(let x = 0; x < patternSize; x++) {
      if(patternSize/3*1 <= x && x < patternSize/3*2) {
        if(y < patternSize/3*2)
        retsu.push(1);
      }
      retsu.push(0);
    }
    pattern.push(retsu);
  }

  return pattern;
}

const getYokoFacePattern = function() {
  const pattern = [];

  for(let y = 0; y < patternSize; y++) {
    const retsu = [];
    for(let x = 0; x < patternSize; x++) {
      if(x < patternSize/3*1 || patternSize/3*2 <= x) {
        if(y < patternSize/3*1) {
          retsu.push(0);
          continue;
        } else if(y < patternSize/3*2) {
          retsu.push(1);
          continue;
        }
      }
      retsu.push(null);
    }
    pattern.push(retsu);
  }

  return pattern;
}

const eyeMove = function(pageX, pageY) {
  const $black_eye_left = SVG('#black_eye_left');
  const $black_eye_right = SVG('#black_eye_right');

  const moveRate = 100;

  const centerX = $('body').width() / 2;
  const centerY = $('body').height() / 2;

  let move_x = 10 * (pageX - centerX) / centerX;
  let move_y = 10 * (pageY - centerY) / centerY;

  if(move_x > 6) {
    move_x = 6;
  }
  if(move_x < -6) {
    move_x = -6;
  }
  if(move_y > 5) {
    move_y = 5;
  }
  if(move_y < -4) {
    move_y = -4;
  }

  $black_eye_left.transform(eye_left_tf);
  $black_eye_left.translate(move_x, move_y);

  $black_eye_right.transform(eye_right_tf);
  $black_eye_right.translate(-move_x, move_y);
}

const getVowel = function(dataArray) {
  let vowel = 0;
  let bestScore = 1500;

  let voiceSum = 0;
  for(let i = 10; i < 40; i += 1) {
    voiceSum += dataArray[i];
  }
  if(voiceSum < 1500) {
    return vowel;
  }

  const scoreA = getVowelScore(dataArray, getVowelA());
  const scoreI = getVowelScore(dataArray, getVowelI());
  const scoreU = getVowelScore(dataArray, getVowelU()) + 300;
  const scoreE = getVowelScore(dataArray, getVowelE());
  const scoreO = getVowelScore(dataArray, getVowelO());

  if(scoreA < bestScore) { vowel = 1; bestScore = scoreA;}
  if(scoreI < bestScore) { vowel = 2; bestScore = scoreI;}
  if(scoreU < bestScore) { vowel = 3; bestScore = scoreU;}
  if(scoreE < bestScore) { vowel = 4; bestScore = scoreE;}
  if(scoreO < bestScore) { vowel = 5; bestScore = scoreO;}

  return vowel;
}

const getVowelScore = function(data, vowel) {
  let score = 0;

  for(let i = 0; i < 128; i += 1) {
    if(vowel[i][0] - 25 < data[i] && data[i] < vowel[i][1] + 25) {
      continue;
    } else {
      const ue = data[i] - (vowel[i][1] + 25);
      const shita = (vowel[i][0] - 25) - data[i];
      if(ue > shita) {
        score += ue;
      }else {
        score += shita;
      }
    }
  }

  return score;
}

const mouthAnimate = function(vowel) {
  const $mouth_open = SVG('#mouth_open');
  const $mouth_close = SVG('#mouth_close');
  const anime_speed = 0.3;

  for(let i = 0; i < 5; i++) {
    if(i + 1 == vowel) {
      mouth_anime_frame[i] += anime_speed;
      if(mouth_anime_frame[i] > 1.0) {
        mouth_anime_frame[i] = 1.0;
      }
    } else {
      mouth_anime_frame[i] -= anime_speed/4;
      if(mouth_anime_frame[i] < 0.0) {
        mouth_anime_frame[i] = 0.0;
      }
    }
  }

  $mouth_open.transform(mouth_open_tf);
  let frame_sum = 0;
  for(let i = 0; i < 5; i++) {
    frame_sum += mouth_anime_frame[i];
  }

  let scaleX = 1, scaleY = 0;
  if(frame_sum > 0) {
    const mouthVowelScale = [
      {x: 0.0, y: 1.0},
      {x: 0.5, y: 0.4},
      {x:-0.5, y: 0.5},
      {x: 0.5, y: 0.7},
      {x:-0.3, y: 1.2}
    ]

    for(let i = 0; i < 5; i++) {
      const par = mouth_anime_frame[i] / frame_sum;

      scaleX += mouth_anime_frame[i] * par * mouthVowelScale[i].x;
      scaleY += mouth_anime_frame[i] * par * mouthVowelScale[i].y;
    }
    $mouth_open.scale(scaleX, scaleY);
  }

  if(scaleY >= 0.2) {
    $mouth_open.show();
    $mouth_close.hide();
  } else {
    $mouth_open.hide();
    $mouth_close.show();
  }
}

const getVowelA = function() {
  const data = [
    [26, 85],
    [8, 74],
    [1, 51],
    [94, 120],
    [128, 154],
    [134, 159],
    [112, 139],
    [68, 97],
    [108, 136],
    [137, 157],
    [134, 154],
    [106, 129],
    [49, 83],
    [100, 126],
    [118, 142],
    [109, 134],
    [71, 103],
    [63, 97],
    [109, 135],
    [118, 144],
    [101, 138],
    [39, 109],
    [69, 117],
    [117, 145],
    [122, 148],
    [97, 130],
    [68, 107],
    [114, 151],
    [145, 171],
    [140, 170],
    [106, 158],
    [72, 119],
    [97, 148],
    [130, 161],
    [122, 153],
    [72, 126],
    [80, 109],
    [97, 138],
    [115, 144],
    [95, 130],
    [57, 109],
    [78, 113],
    [95, 133],
    [104, 131],
    [70, 126],
    [54, 105],
    [74, 128],
    [105, 144],
    [110, 139],
    [71, 126],
    [81, 119],
    [104, 140],
    [121, 147],
    [106, 142],
    [63, 133],
    [37, 101],
    [64, 108],
    [69, 110],
    [52, 91],
    [22, 76],
    [15, 72],
    [0, 74],
    [9, 74],
    [25, 73],
    [21, 60],
    [18, 70],
    [33, 81],
    [33, 71],
    [9, 53],
    [5, 48],
    [0, 47],
    [3, 60],
    [0, 54],
    [0, 51],
    [0, 33],
    [5, 51],
    [22, 61],
    [0, 52],
    [0, 45],
    [0, 45],
    [7, 56],
    [0, 55],
    [0, 51],
    [0, 40],
    [0, 30],
    [0, 43],
    [0, 44],
    [0, 35],
    [0, 28],
    [0, 39],
    [4, 44],
    [0, 33],
    [0, 35],
    [0, 18],
    [0, 34],
    [0, 44],
    [0, 39],
    [0, 38],
    [3, 39],
    [9, 51],
    [13, 50],
    [0, 41],
    [0, 40],
    [0, 41],
    [0, 46],
    [0, 34],
    [0, 22],
    [0, 20],
    [0, 38],
    [0, 35],
    [0, 37],
    [0, 39],
    [0, 34],
    [4, 48],
    [6, 47],
    [0, 39],
    [0, 32],
    [4, 36],
    [3, 41],
    [1, 51],
    [0, 52],
    [15, 54],
    [38, 71],
    [42, 82],
    [25, 83],
    [0, 77],
    [42, 83],
    [52, 98],
    [54, 98],
    [25, 82],
    [0, 68],
    [27, 75],
    [39, 83],
    [35, 72],
    [0, 65],
    [0, 50],
    [17, 60],
    [21, 66],
    [10, 57],
    [0, 41],
    [0, 36],
    [4, 51],
    [0, 46],
    [4, 39],
    [0, 29],
    [0, 25],
    [0, 31],
    [0, 26],
    [0, 36],
    [0, 53],
    [18, 64],
    [31, 71],
    [20, 85],
    [21, 94],
    [59, 93],
    [69, 105],
    [77, 108],
    [62, 107],
    [57, 103],
    [64, 97],
    [70, 107],
    [69, 108],
    [33, 100],
    [35, 100],
    [62, 97],
    [53, 103],
    [59, 95],
    [37, 92],
    [0, 81],
    [42, 81],
    [50, 84],
    [0, 80],
    [27, 70],
    [17, 61],
    [27, 64],
    [32, 66],
    [18, 59],
    [3, 57],
    [21, 52],
    [19, 60],
    [21, 55],
    [0, 50],
    [5, 44],
    [4, 44],
    [10, 50],
    [17, 47],
    [0, 46],
    [4, 48],
    [17, 53],
    [15, 52],
    [0, 54],
    [0, 54],
    [0, 57],
    [8, 62],
    [7, 62],
    [0, 64],
    [0, 61],
    [24, 56],
    [23, 60],
    [21, 59],
    [0, 59],
    [2, 50],
    [4, 50],
    [10, 55],
    [0, 53],
    [0, 49],
    [18, 47],
    [18, 52],
    [18, 49],
    [7, 52],
    [3, 46],
    [0, 50],
    [14, 57],
    [4, 55],
    [0, 56],
    [18, 56],
    [12, 50],
    [0, 49],
    [0, 41],
    [0, 41],
    [0, 39],
    [0, 38],
    [0, 38],
    [0, 27],
    [0, 15],
    [0, 3],
    [0, 3],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 4],
    [0, 1],
    [0, 0],
    [0, 10],
    [0, 6],
    [0, 0],
    [0, 5],
    [0, 4],
    [0, 0],
    [0, 0],
    [0, 3],
    [0, 14],
    [0, 12],
    [0, 13],
    [0, 15],
    [0, 19],
    [0, 18],
    [0, 14],
    [0, 10]
  ];

  return data;
}

const getVowelI = function() {
  const data = [
    [18, 91],
    [36, 92],
    [18, 78],
    [43, 71],
    [111, 134],
    [135, 159],
    [132, 157],
    [100, 130],
    [39, 85],
    [113, 133],
    [147, 170],
    [154, 179],
    [135, 163],
    [77, 114],
    [48, 73],
    [104, 126],
    [121, 144],
    [113, 139],
    [75, 106],
    [11, 64],
    [80, 97],
    [106, 128],
    [107, 133],
    [79, 115],
    [11, 65],
    [25, 46],
    [48, 80],
    [64, 93],
    [53, 84],
    [16, 49],
    [0, 34],
    [12, 41],
    [35, 65],
    [39, 66],
    [19, 47],
    [0, 26],
    [0, 19],
    [0, 33],
    [5, 38],
    [0, 29],
    [0, 16],
    [0, 20],
    [7, 35],
    [30, 58],
    [25, 57],
    [0, 37],
    [0, 12],
    [0, 5],
    [0, 5],
    [0, 9],
    [0, 6],
    [0, 6],
    [0, 9],
    [0, 20],
    [4, 38],
    [0, 35],
    [0, 13],
    [0, 8],
    [0, 6],
    [0, 17],
    [0, 10],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 6],
    [0, 5],
    [0, 2],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 1],
    [0, 2],
    [0, 2],
    [0, 9],
    [0, 0],
    [0, 0],
    [0, 5],
    [0, 30],
    [0, 36],
    [0, 23],
    [0, 0],
    [0, 1],
    [0, 31],
    [13, 42],
    [0, 37],
    [0, 13],
    [0, 0],
    [0, 12],
    [12, 47],
    [8, 59],
    [0, 58],
    [0, 42],
    [27, 69],
    [73, 97],
    [74, 108],
    [46, 103],
    [27, 87],
    [39, 68],
    [50, 84],
    [55, 97],
    [55, 93],
    [0, 71],
    [8, 53],
    [33, 66],
    [53, 79],
    [40, 85],
    [0, 84],
    [0, 67],
    [15, 48],
    [19, 61],
    [26, 70],
    [17, 68],
    [0, 49],
    [0, 26],
    [7, 48],
    [28, 66],
    [13, 72],
    [1, 64],
    [0, 44],
    [2, 52],
    [33, 72],
    [43, 78],
    [19, 73],
    [0, 54],
    [0, 37],
    [18, 58],
    [36, 71],
    [23, 68],
    [0, 61],
    [15, 56],
    [17, 77],
    [38, 98],
    [52, 100],
    [42, 94],
    [14, 75],
    [26, 70],
    [47, 85],
    [66, 90],
    [51, 88],
    [17, 88],
    [42, 74],
    [45, 72],
    [58, 93],
    [51, 99],
    [0, 88],
    [0, 75],
    [33, 70],
    [59, 83],
    [64, 91],
    [47, 89],
    [19, 89],
    [30, 73],
    [34, 84],
    [54, 98],
    [52, 97],
    [12, 88],
    [6, 62],
    [17, 60],
    [28, 71],
    [37, 75],
    [23, 69],
    [0, 53],
    [1, 43],
    [2, 56],
    [20, 61],
    [3, 50],
    [1, 41],
    [0, 29],
    [0, 20],
    [0, 17],
    [0, 25],
    [0, 35],
    [0, 29],
    [0, 20],
    [0, 42],
    [1, 42],
    [0, 44],
    [0, 37],
    [0, 32],
    [0, 19],
    [0, 22],
    [0, 30],
    [0, 33],
    [0, 30],
    [0, 29],
    [0, 25],
    [0, 20],
    [0, 23],
    [0, 13],
    [0, 10],
    [0, 5],
    [0, 3],
    [0, 6],
    [0, 3],
    [0, 5],
    [0, 0],
    [0, 0],
    [0, 3],
    [0, 8],
    [0, 15],
    [0, 13],
    [0, 17],
    [0, 23],
    [0, 27],
    [0, 27],
    [0, 29],
    [0, 29],
    [0, 32],
    [3, 37],
    [0, 33],
    [0, 33],
    [0, 33],
    [2, 29],
    [0, 36],
    [0, 39],
    [0, 46],
    [5, 51],
    [20, 52],
    [25, 57],
    [22, 63],
    [26, 56],
    [20, 54],
    [21, 53],
    [19, 42],
    [0, 45],
    [0, 44],
    [0, 37],
    [0, 37],
    [0, 34],
    [0, 31],
    [0, 33],
    [0, 28],
    [0, 27],
    [0, 23],
    [0, 23],
    [0, 34],
    [0, 38],
    [0, 33],
    [0, 32],
    [3, 39],
    [0, 50],
    [0, 45],
    [0, 39],
    [4, 41],
    [17, 53],
    [6, 67],
    [19, 71]
  ];

  return data;
}

const getVowelU = function() {
  const data = [
    [12, 87],
    [9, 79],
    [0, 53],
    [38, 102],
    [88, 145],
    [103, 158],
    [92, 146],
    [45, 105],
    [45, 124],
    [96, 155],
    [114, 167],
    [105, 157],
    [66, 121],
    [42, 115],
    [92, 150],
    [111, 162],
    [104, 154],
    [62, 120],
    [42, 113],
    [88, 149],
    [109, 157],
    [105, 149],
    [58, 116],
    [32, 93],
    [65, 110],
    [78, 117],
    [69, 112],
    [4, 84],
    [3, 50],
    [20, 76],
    [33, 81],
    [14, 77],
    [0, 51],
    [0, 52],
    [20, 73],
    [40, 85],
    [24, 85],
    [0, 66],
    [0, 57],
    [15, 73],
    [25, 83],
    [26, 77],
    [0, 54],
    [0, 53],
    [0, 65],
    [10, 64],
    [3, 58],
    [0, 44],
    [0, 41],
    [0, 46],
    [11, 51],
    [9, 50],
    [0, 42],
    [0, 42],
    [0, 46],
    [0, 45],
    [0, 41],
    [0, 43],
    [0, 49],
    [0, 61],
    [21, 73],
    [23, 76],
    [0, 70],
    [0, 75],
    [0, 78],
    [19, 85],
    [22, 86],
    [0, 85],
    [0, 81],
    [5, 76],
    [23, 77],
    [24, 73],
    [2, 64],
    [0, 53],
    [0, 69],
    [0, 68],
    [0, 49],
    [0, 47],
    [0, 46],
    [0, 41],
    [0, 47],
    [0, 47],
    [0, 39],
    [0, 30],
    [0, 48],
    [0, 46],
    [0, 29],
    [0, 24],
    [0, 31],
    [0, 40],
    [0, 47],
    [2, 57],
    [0, 54],
    [0, 64],
    [0, 74],
    [5, 80],
    [12, 77],
    [0, 65],
    [0, 66],
    [0, 70],
    [10, 76],
    [0, 81],
    [0, 80],
    [0, 81],
    [0, 85],
    [16, 83],
    [0, 86],
    [11, 81],
    [0, 78],
    [0, 81],
    [0, 75],
    [13, 74],
    [0, 65],
    [0, 62],
    [0, 58],
    [0, 55],
    [0, 56],
    [0, 59],
    [0, 50],
    [0, 47],
    [0, 51],
    [0, 50],
    [0, 39],
    [0, 34],
    [0, 34],
    [0, 32],
    [0, 30],
    [0, 35],
    [0, 28],
    [0, 24],
    [0, 22],
    [0, 22],
    [0, 22],
    [0, 19],
    [0, 17],
    [0, 19],
    [0, 22],
    [0, 23],
    [0, 10],
    [0, 11],
    [0, 12],
    [0, 5],
    [0, 2],
    [0, 0],
    [0, 5],
    [0, 9],
    [0, 19],
    [0, 32],
    [0, 38],
    [0, 64],
    [0, 80],
    [0, 79],
    [4, 71],
    [10, 62],
    [0, 70],
    [15, 85],
    [24, 83],
    [26, 81],
    [15, 81],
    [3, 84],
    [0, 85],
    [11, 82],
    [0, 79],
    [0, 71],
    [0, 65],
    [0, 62],
    [0, 60],
    [0, 63],
    [0, 53],
    [0, 49],
    [0, 43],
    [0, 41],
    [0, 33],
    [0, 32],
    [0, 32],
    [0, 31],
    [0, 36],
    [0, 41],
    [0, 40],
    [0, 43],
    [0, 42],
    [0, 45],
    [0, 49],
    [0, 48],
    [0, 45],
    [0, 53],
    [0, 60],
    [0, 57],
    [0, 51],
    [0, 55],
    [0, 55],
    [0, 56],
    [0, 53],
    [0, 49],
    [0, 42],
    [0, 43],
    [0, 39],
    [0, 29],
    [0, 22],
    [0, 20],
    [0, 25],
    [0, 16],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 7],
    [0, 12],
    [0, 9],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 2],
    [0, 6],
    [0, 0],
    [0, 18],
    [0, 25],
    [0, 31],
    [0, 35],
    [0, 29],
    [0, 20],
    [0, 25],
    [0, 27],
    [0, 24],
    [0, 18],
    [0, 28],
    [0, 29],
    [0, 21],
    [0, 13],
    [0, 12],
    [0, 19],
    [0, 32]
  ];

  return data;
}

const getVowelE = function() {
  const data = [
    [0, 87],
    [0, 74],
    [0, 43],
    [76, 117],
    [109, 151],
    [113, 156],
    [91, 136],
    [41, 90],
    [95, 129],
    [120, 150],
    [117, 148],
    [87, 120],
    [57, 94],
    [96, 125],
    [114, 136],
    [107, 127],
    [62, 93],
    [71, 111],
    [111, 138],
    [119, 145],
    [97, 130],
    [44, 95],
    [93, 132],
    [117, 154],
    [113, 154],
    [81, 132],
    [86, 136],
    [122, 160],
    [144, 170],
    [133, 163],
    [87, 132],
    [50, 104],
    [65, 118],
    [91, 121],
    [73, 106],
    [0, 100],
    [55, 106],
    [67, 114],
    [79, 113],
    [49, 101],
    [35, 95],
    [36, 100],
    [73, 105],
    [68, 99],
    [30, 74],
    [13, 64],
    [33, 75],
    [37, 82],
    [21, 73],
    [10, 73],
    [0, 78],
    [35, 81],
    [45, 83],
    [26, 72],
    [0, 61],
    [0, 55],
    [6, 70],
    [10, 66],
    [4, 63],
    [8, 67],
    [0, 78],
    [41, 84],
    [32, 78],
    [3, 74],
    [11, 75],
    [31, 77],
    [34, 80],
    [0, 68],
    [20, 73],
    [29, 87],
    [40, 94],
    [52, 88],
    [20, 82],
    [0, 87],
    [48, 101],
    [71, 107],
    [57, 102],
    [32, 95],
    [62, 116],
    [71, 128],
    [92, 129],
    [67, 118],
    [60, 114],
    [54, 110],
    [56, 107],
    [56, 101],
    [34, 93],
    [33, 89],
    [31, 89],
    [40, 90],
    [27, 87],
    [1, 73],
    [33, 68],
    [21, 78],
    [40, 82],
    [18, 73],
    [19, 74],
    [18, 77],
    [32, 80],
    [33, 83],
    [15, 78],
    [20, 75],
    [31, 80],
    [31, 86],
    [24, 82],
    [19, 72],
    [22, 70],
    [24, 75],
    [34, 75],
    [25, 76],
    [27, 81],
    [45, 91],
    [49, 95],
    [46, 99],
    [46, 103],
    [41, 104],
    [53, 100],
    [51, 102],
    [46, 99],
    [30, 93],
    [33, 94],
    [37, 90],
    [29, 84],
    [20, 83],
    [20, 82],
    [10, 74],
    [0, 71],
    [12, 69],
    [0, 65],
    [2, 63],
    [14, 62],
    [9, 64],
    [3, 61],
    [2, 56],
    [0, 63],
    [0, 64],
    [0, 61],
    [1, 55],
    [0, 57],
    [0, 57],
    [12, 58],
    [0, 57],
    [0, 48],
    [0, 47],
    [0, 53],
    [0, 56],
    [0, 51],
    [0, 52],
    [0, 55],
    [0, 58],
    [7, 66],
    [7, 59],
    [0, 55],
    [0, 57],
    [7, 67],
    [12, 66],
    [0, 64],
    [0, 59],
    [0, 59],
    [2, 71],
    [0, 67],
    [5, 60],
    [10, 57],
    [0, 68],
    [6, 69],
    [0, 64],
    [0, 74],
    [0, 84],
    [0, 88],
    [7, 85],
    [33, 80],
    [27, 88],
    [0, 94],
    [26, 93],
    [18, 89],
    [6, 84],
    [3, 86],
    [15, 79],
    [25, 84],
    [19, 77],
    [10, 70],
    [13, 69],
    [24, 73],
    [23, 77],
    [2, 69],
    [0, 66],
    [13, 61],
    [14, 65],
    [18, 64],
    [21, 65],
    [14, 67],
    [25, 71],
    [27, 74],
    [24, 69],
    [0, 67],
    [0, 70],
    [17, 66],
    [12, 65],
    [5, 63],
    [0, 56],
    [0, 55],
    [0, 52],
    [0, 49],
    [0, 52],
    [0, 56],
    [0, 55],
    [2, 55],
    [0, 56],
    [0, 56],
    [0, 57],
    [0, 55],
    [0, 61],
    [0, 57],
    [0, 58],
    [0, 55],
    [0, 50],
    [0, 45],
    [0, 47],
    [0, 47],
    [0, 41],
    [0, 39],
    [0, 38],
    [0, 38],
    [0, 32],
    [0, 30],
    [0, 24],
    [0, 26],
    [0, 23],
    [0, 16],
    [0, 11],
    [0, 4],
    [0, 7],
    [0, 4],
    [0, 0],
    [0, 0],
    [0, 1],
    [0, 1],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 2],
    [0, 1],
    [0, 6],
    [0, 14],
    [0, 15],
    [0, 8],
    [0, 8],
    [0, 3],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0]
  ];

  return data;
}

const getVowelO = function() {
  const data = [
    [32, 68],
    [27, 60],
    [0, 35],
    [84, 92],
    [129, 134],
    [142, 146],
    [129, 132],
    [80, 92],
    [86, 105],
    [132, 137],
    [144, 148],
    [128, 134],
    [76, 90],
    [67, 86],
    [115, 125],
    [127, 133],
    [109, 119],
    [51, 80],
    [95, 114],
    [139, 151],
    [150, 158],
    [131, 144],
    [77, 105],
    [110, 132],
    [155, 166],
    [166, 173],
    [145, 158],
    [91, 121],
    [88, 113],
    [131, 141],
    [142, 147],
    [119, 130],
    [58, 92],
    [70, 101],
    [119, 129],
    [121, 136],
    [95, 125],
    [60, 119],
    [97, 122],
    [127, 150],
    [136, 155],
    [117, 139],
    [60, 95],
    [48, 85],
    [72, 95],
    [70, 100],
    [42, 88],
    [10, 76],
    [32, 74],
    [51, 83],
    [49, 84],
    [41, 67],
    [0, 53],
    [7, 43],
    [42, 57],
    [36, 59],
    [1, 46],
    [0, 39],
    [3, 34],
    [27, 50],
    [30, 54],
    [7, 42],
    [0, 40],
    [0, 33],
    [0, 40],
    [0, 41],
    [0, 31],
    [0, 24],
    [0, 21],
    [0, 25],
    [2, 25],
    [0, 12],
    [0, 9],
    [0, 8],
    [0, 11],
    [0, 11],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 6],
    [0, 8],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 5],
    [0, 6],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 13],
    [0, 18],
    [0, 5],
    [0, 0],
    [0, 0],
    [0, 9],
    [0, 7],
    [0, 3],
    [0, 1],
    [0, 0],
    [0, 13],
    [0, 11],
    [0, 0],
    [0, 0],
    [0, 8],
    [0, 15],
    [0, 9],
    [0, 0],
    [0, 0],
    [0, 3],
    [0, 12],
    [0, 10],
    [0, 0],
    [0, 2],
    [0, 32],
    [0, 38],
    [0, 31],
    [0, 13],
    [0, 21],
    [0, 48],
    [0, 57],
    [0, 58],
    [0, 41],
    [0, 29],
    [0, 41],
    [0, 44],
    [0, 35],
    [0, 18],
    [0, 14],
    [0, 20],
    [0, 27],
    [0, 20],
    [0, 4],
    [0, 0],
    [0, 6],
    [0, 13],
    [0, 6],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 11],
    [0, 4],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 14],
    [0, 13],
    [0, 1],
    [0, 7],
    [0, 21],
    [7, 43],
    [0, 48],
    [0, 47],
    [0, 44],
    [23, 52],
    [27, 58],
    [16, 61],
    [6, 50],
    [9, 51],
    [36, 62],
    [44, 70],
    [32, 71],
    [23, 67],
    [14, 58],
    [16, 59],
    [19, 54],
    [12, 50],
    [1, 35],
    [0, 36],
    [5, 43],
    [5, 48],
    [2, 38],
    [0, 25],
    [0, 19],
    [0, 28],
    [0, 37],
    [0, 37],
    [0, 25],
    [0, 27],
    [0, 37],
    [0, 42],
    [0, 40],
    [0, 27],
    [0, 31],
    [0, 44],
    [0, 48],
    [0, 40],
    [0, 33],
    [0, 43],
    [0, 54],
    [7, 56],
    [2, 51],
    [0, 34],
    [0, 36],
    [0, 42],
    [0, 32],
    [0, 29],
    [0, 21],
    [0, 13],
    [0, 10],
    [0, 10],
    [0, 3],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 8],
    [0, 11],
    [0, 12],
    [0, 14],
    [0, 13],
    [0, 7],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0]
  ];

  return data;
}
