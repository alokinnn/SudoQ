'use strict';

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';

import {
  LayoutAnimation,
  StyleSheet,
  AppState,
  Platform,
  Linking,
  Share,
  Alert,
  Modal,
  Image,
  View,
  Text,
} from 'react-native';

import DeviceInfo from 'react-native-device-info';

import {
  Size,
  CellSize,
  BoardWidth,

  Board,
  Timer,
  Touchable,
} from '../components';
import {
  Store,
  sudoku,
} from '../utils';

const formatTime = Timer.formatTime;

const I18n = {
  t: (a) => a,
};

const Main = () => {
  // State
  const [puzzle, setPuzzle] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [initing, setIniting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showRecord, setShowRecord] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [records, setRecords] = useState([]);
  const [scores, setScores] = useState(null); // kept for compatibility with original render
  const [rank, setRank] = useState(null);     // kept for compatibility with original render

  // "Instance fields" -> refs
  const puzzleRef = useRef(null);
  const solveRef = useRef(null);
  const errorRef = useRef(0);
  const elapsedRef = useRef(null);
  const fromStoreRef = useRef(false);
  const grantedRef = useRef(false);
  const nextPuzzleRef = useRef(null);
  const timerRef = useRef(null);
  const wsRef = useRef(null);

  const onInit = useCallback(() => {
    setIniting(false);
    setPlaying(true);
    setShowModal(false);
    setShowRecord(false);
    setIsOnline(false);

    timerRef.current?.start?.();
  }, []);

  const onErrorMove = useCallback(() => {
    errorRef.current += 1;
    const err = errorRef.current;
    const message =
      err > 3 ? I18n.t('fail') : I18n.t('errormove', { error: err });

    Alert.alert(I18n.t('nosolve'), message, [
      { text: I18n.t('ok') },
      { text: I18n.t('newgame'), onPress: () => onCreate() },
    ]);
  }, [onCreate]);

  const onFinish = useCallback((puzzlee) => {
    DeviceInfo.getDeviceName().then((name) => {
      wsRef.current?.send?.(JSON.stringify({ username: name, puzzle: puzzlee }));
    });

    setPlaying(false);
    Store.multiRemove('puzzle', 'solve', 'error', 'elapsed');

    elapsedRef.current = null;
    solveRef.current = null;
    fromStoreRef.current = false;

    const elapsed = timerRef.current?.stop?.();
    if (elapsed == null) return;

    if (errorRef.current > 3) {
      // original code just returns here
      return;
    }

    setRecords((prev) => {
      if (prev.includes(elapsed)) return prev;

      let list = [...prev, elapsed];
      list.sort((a, b) => a - b);
      list = list.slice(0, 5);
      Store.set('records', list);
      return list;
    });

    const newRecord = (records.length > 1 && elapsed === records[0]);
    // original had an Alert here, commented out
  }, [records]);

  const onToggleEditing = useCallback(() => {
    setEditing((prev) => !prev);
  }, []);

  const onResume = useCallback(() => {
    if (fromStoreRef.current) {
      if (elapsedRef.current != null) {
        timerRef.current?.setElapsed?.(elapsedRef.current);
      }
      setPuzzle(puzzleRef.current);
      setIniting(true);
      setShowModal(false);
      setShowRecord(false);
      fromStoreRef.current = false;
      return;
    }

    timerRef.current?.resume?.();
    setShowModal(false);
    setShowRecord(false);
  }, []);

  const onClear = useCallback(() => {
    elapsedRef.current = null;
    errorRef.current = 0;
    solveRef.current = null;
    fromStoreRef.current = false;

    timerRef.current?.reset?.();
    Store.multiRemove('solve', 'error', 'elapsed');

    if (puzzleRef.current) {
      setPuzzle(puzzleRef.current.slice());
    }

    setIniting(true);
    setEditing(false);
    setPlaying(false);
    setShowModal(false);
    setShowRecord(false);
  }, []);

  const onCreate = useCallback(() => {
    elapsedRef.current = null;
    errorRef.current = 0;
    solveRef.current = null;
    fromStoreRef.current = false;

    timerRef.current?.reset?.();

    let newPuzzle;
    if (nextPuzzleRef.current) {
      newPuzzle = nextPuzzleRef.current.slice();
      nextPuzzleRef.current = null;
    } else {
      newPuzzle = sudoku.makepuzzle();
    }

    setPuzzle(newPuzzle);
    setIniting(true);
    setEditing(false);
    setPlaying(false);
    setShowModal(false);
    setShowRecord(false);

    (async () => {
      await Store.multiRemove('puzzle', 'solve', 'error', 'elapsed');
      puzzleRef.current = newPuzzle.slice();
      Store.set('puzzle', puzzleRef.current);
    })();
  }, []);

  const onCreateOnline = useCallback(() => {
    elapsedRef.current = null;
    errorRef.current = 0;
    solveRef.current = null;
    fromStoreRef.current = false;
    timerRef.current?.reset?.();

    setIsOnline(true);

    const ws = new WebSocket('ws://sudoq.eu-north-1.elasticbeanstalk.com/ws');
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Connection opened');
    };

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data.toString());

      if (data.username) {
        if (data.isWinner) {
          Alert.alert('Winner', data.username + ' is winner');
        }
        return;
      }

      setPuzzle(data);
      setIniting(true);
      setEditing(false);
      setPlaying(false);
      setShowModal(false);
      setShowRecord(false);

      (async () => {
        await Store.multiRemove('puzzle', 'solve', 'error', 'elapsed');
        puzzleRef.current = data.slice();
        Store.set('puzzle', puzzleRef.current);
      })();
    };

    ws.onerror = (e) => {
      console.log(e.message);
      const msg = e?.message ?? e?.type ?? 'unknown error';
      const msg2 = msg + ' ::: ' + JSON.stringify(e);
      Share.share({ message: msg2, title: 'error' });
    };

    ws.onclose = (e) => {
      console.log(e.code, e.reason);
      Share.share({
        message:
          JSON.stringify(e) +
          ' ::: ' +
          e.code +
          e.reason +
          e.wasClean,
        title: 'close',
      });
    };
  }, []);

  const onToggleRecord = useCallback(() => {
    LayoutAnimation.easeInEaseOut();
    setShowRecord((prev) => !prev);
  }, []);

  const onToggleOnline = useCallback(async () => {
    if (!grantedRef.current) {
      const upload = await new Promise((resolve) => {
        Alert.alert(I18n.t('uploadrecord'), I18n.t('uploadmessage'), [
          {
            text: I18n.t('reject'),
            onPress: () => resolve(false),
          },
          {
            text: I18n.t('grant'),
            onPress: () => resolve(true),
          },
        ]);
      });

      if (!upload) return;

      grantedRef.current = true;
      Store.set('granted', true);
    }

    LayoutAnimation.easeInEaseOut();
    // original only animates, more logic may be elsewhere
  }, []);

  const onShowModal = useCallback(() => {
    if (!initing) {
      if (solveRef.current) {
        Store.set('solve', solveRef.current);
      }
      if (errorRef.current) {
        Store.set('error', errorRef.current);
      }
      const elapsed = timerRef.current?.pause?.();
      if (elapsed) {
        elapsedRef.current = elapsed;
        Store.set('elapsed', elapsed);
      }
    }

    setShowModal(true);
    setShowRecord(false);

    if (!nextPuzzleRef.current) {
      nextPuzzleRef.current = sudoku.makepuzzle();
    }
  }, [initing]);

  const onCloseModal = useCallback(() => {
    timerRef.current?.resume?.();
    setShowRecord(false);

    requestAnimationFrame(() => {
      setShowModal(false);
    });
  }, []);

  const onShare = useCallback(() => {
    const url = 'http://a.app.qq.com/o/simple.jsp?pkgname=com.liteneo.sudoku';
    let message = I18n.t('sharemessage');
    if (Platform.OS === 'android') {
      message = message + ' \n' + url;
    }

    Share.share(
      {
        url,
        message,
        title: I18n.t('share'),
      },
      {
        dialogTitle: I18n.t('share'),
      },
    ).catch(() => {
      Alert.alert(I18n.t('sharefailed'));
    });
  }, []);

  const onRate = useCallback(() => {
    const link =
      Platform.OS === 'android'
        ? 'market://details?id=com.liteneo.sudoku'
        : 'itms-apps://itunes.apple.com/cn/app/id1138612488?mt=8';

    Alert.alert(I18n.t('rate'), I18n.t('ratemessage'), [
      { text: I18n.t('cancel') },
      {
        text: I18n.t('confirm'),
        onPress: () => Linking.openURL(link),
      },
    ]);
  }, []);

  const handleAppStateChange = useCallback(
    (currentAppState) => {
      if (currentAppState !== 'active') {
        onShowModal();
      }
    },
    [onShowModal],
  );

  // componentDidMount / componentWillUnmount equivalent
  // 1) Run init ONCE (componentDidMount equivalent)
useEffect(() => {
  let isMounted = true;

  const init = async () => {
    const storedRecords = (await Store.get('records')) || [];
    if (isMounted) {
      setRecords(storedRecords);
    }

    const storedPuzzle = await Store.get('puzzle');
    if (storedPuzzle) {
      puzzleRef.current = storedPuzzle.slice();
      fromStoreRef.current = true;
      solveRef.current = await Store.get('solve');
      errorRef.current = (await Store.get('error')) || 0;
      elapsedRef.current = await Store.get('elapsed');
    }

    setShowModal(true);                  // only once now
    nextPuzzleRef.current = sudoku.makepuzzle();
    grantedRef.current = await Store.get('granted');
  };

  init();

  return () => {
    isMounted = false;
    if (wsRef.current) {
      wsRef.current.close();
    }
  };
}, []); // ⬅️ empty deps: run once

// 2) Manage AppState listener, re-subscribe when handler changes
useEffect(() => {
  const subscription = AppState.addEventListener('change', handleAppStateChange);
  return () => {
    subscription.remove?.();
  };
}, [handleAppStateChange]);

  // derive some values for render
  if (puzzle && !solveRef.current) {
    solveRef.current = puzzle.slice();
  }

  const disabled = !playing && !fromStoreRef.current;

  let recordHeight = 0;
  if (showRecord) {
    recordHeight = CellSize / 3 + CellSize * (records.length + 1);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Touchable disabled={initing} onPress={onShowModal}>
          <Image
            style={[styles.icon, initing && styles.disabled]}
            source={require('../images/menu.png')}
          />
        </Touchable>
        <Timer
          ref={timerRef}
          style={styles.timer}
          disabledStyle={styles.disabled}
        />
        <Touchable disabled={!playing} onPress={onToggleEditing}>
          <Image
            style={[
              styles.icon,
              editing && { tintColor: 'khaki' },
              !playing && styles.disabled,
            ]}
            source={require('../images/edit.png')}
          />
        </Touchable>
      </View>

      <Board
        puzzle={puzzle}
        solve={solveRef.current}
        editing={editing}
        onInit={onInit}
        onErrorMove={onErrorMove}
        onFinish={onFinish}
      />

      <Modal
        animationType="slide"
        visible={showModal}
        transparent={true}
        onRequestClose={onCloseModal}
      >
        <View style={styles.modal}>
          <View style={[styles.modalContainer, { marginTop: 0 }]}>
            {!showRecord && (
              <Text style={styles.title}>{I18n.t('name')}</Text>
            )}
            {!showRecord && (
              <Text style={styles.about}>by Neo(nihgwu@live.com)</Text>
            )}

            <Touchable disabled={disabled} style={styles.button} onPress={onResume}>
              <Image
                style={[styles.buttonIcon, disabled && styles.disabled]}
                source={require('../images/play.png')}
              />
              <Text style={[styles.buttonText, disabled && styles.disabled]}>
                {I18n.t('continue')}
              </Text>
            </Touchable>

            <Touchable disabled={disabled} style={styles.button} onPress={onClear}>
              <Image
                style={[styles.buttonIcon, disabled && styles.disabled]}
                source={require('../images/reload.png')}
              />
              <Text style={[styles.buttonText, disabled && styles.disabled]}>
                {I18n.t('restart')}
              </Text>
            </Touchable>

            <Touchable style={styles.button} onPress={onCreate}>
              <Image
                style={styles.buttonIcon}
                source={require('../images/shuffle.png')}
              />
              <Text style={styles.buttonText}>{I18n.t('newgame')}</Text>
            </Touchable>

            <Touchable style={styles.button} onPress={onCreateOnline}>
              <Image
                style={styles.buttonIcon}
                source={require('../images/shuffle.png')}
              />
              <Text style={styles.buttonText}>{I18n.t('newgameOnline')}</Text>
            </Touchable>

            <Touchable style={styles.button} onPress={onToggleRecord}>
              <Image
                style={styles.buttonIcon}
                source={require('../images/rank.png')}
              />
              <Text style={styles.buttonText}>{I18n.t('weekrank')}</Text>
            </Touchable>

            <View style={{ overflow: 'hidden', height: recordHeight }}>
              <Touchable style={styles.record} onPress={onToggleRecord}>
                <View style={styles.triangle} />
                {records.length > 0 ? (
                  records.map((item, idx) => (
                    <Text key={idx} style={styles.recordText}>
                      {formatTime(item)}
                    </Text>
                  ))
                ) : (
                  <Text style={styles.recordText}>{I18n.t('norecord')}</Text>
                )}
              </Touchable>

              {showRecord && (
                <Text style={styles.recordText} onPress={onToggleOnline}>
                  {I18n.t('onlinerank')}
                </Text>
              )}
            </View>

            <View style={{ overflow: 'hidden' }}>
              {!!scores && scores.length > 0 && (
                <Touchable style={styles.record} onPress={onToggleOnline}>
                  <View style={styles.triangle} />
                  {scores.map((item, idx) => (
                    <Text
                      key={idx}
                      style={[
                        styles.recordText,
                        idx + 1 === rank && styles.highlightText,
                      ]}
                    >
                      {formatTime(item.get('elapsed'))}
                    </Text>
                  ))}
                </Touchable>
              )}
              {!!rank && (
                <Text style={styles.recordText} onPress={onToggleOnline}>
                  {I18n.t('rank', { rank })}
                </Text>
              )}
            </View>

            {fetching && (
              <Text style={[styles.recordText, styles.highlightText]}>
                {I18n.t('loading')}
              </Text>
            )}
          </View>

          <View style={styles.footer}>
            <Touchable style={styles.button} onPress={onShare}>
              <Image
                style={[styles.buttonIcon, styles.disabled]}
                source={require('../images/share.png')}
              />
            </Touchable>
            <Touchable style={styles.button} onPress={onCloseModal}>
              <Image
                style={[styles.buttonIcon, styles.disabled]}
                source={require('../images/close.png')}
              />
            </Touchable>
            <Touchable style={styles.button} onPress={onRate}>
              <Image
                style={[styles.buttonIcon, styles.disabled]}
                source={require('../images/rate.png')}
              />
            </Touchable>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'cadetblue',
    paddingBottom: CellSize,
  },
  header: {
    width: BoardWidth,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  icon: {
    width: CellSize,
    height: CellSize,
  },
  timer: {
    fontSize: (CellSize * 3) / 4,
    alignSelf: 'center',
    color: '#fff',
    opacity: 1,
  },
  modal: {
    flex: 1,
    backgroundColor: 'teal',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
  editing: {
    tintColor: 'khaki',
    opacity: 1,
  },
  title: {
    marginTop: 30,
    marginBottom: 10,
    textAlign: 'center',
    fontSize: CellSize,
    color: '#fff',
  },
  about: {
    marginBottom: 20,
    textAlign: 'center',
    fontSize: CellSize / 2,
    color: '#fff',
    opacity: 0.5,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  button: {
    padding: Size.height > 500 ? 20 : 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    width: CellSize,
    height: CellSize,
  },
  buttonText: {
    marginLeft: CellSize / 2,
    color: '#fff',
    fontSize: (CellSize * 3) / 4,
    fontFamily: 'Menlo',
  },
  record: {
    backgroundColor: 'cadetblue',
    paddingVertical: CellSize / 6,
    borderColor: 'darkcyan',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  recordText: {
    height: (CellSize * 4) / 6,
    marginVertical: CellSize / 6,
    textAlign: 'center',
    color: '#fff',
    fontFamily: 'Menlo',
    fontSize: (CellSize * 2) / 4,
    lineHeight:
      Platform.OS === 'android'
        ? Math.floor((CellSize * 4) / 6)
        : (CellSize * 4) / 6,
  },
  highlightText: {
    color: 'khaki',
  },
  triangle: {
    position: 'absolute',
    left: Size.width / 2 - CellSize / 3 / 2,
    top: -CellSize / 3 / 2,
    width: CellSize / 3,
    height: CellSize / 3,
    backgroundColor: 'teal',
    borderColor: 'darkcyan',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    transform: [
      {
        rotate: '45deg',
      },
    ],
  },
});

export default Main;
