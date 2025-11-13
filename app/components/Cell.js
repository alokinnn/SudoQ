'use strict';

import React, {
  useState,
  useRef,
  useImperativeHandle,
  useCallback,
  forwardRef,
} from 'react';

import {
  LayoutAnimation,
  StyleSheet,
  Animated,
  Platform,
  Text,
} from 'react-native';

import {
  CellSize,
  BorderWidth,
} from './GlobalStyle';
import Touchable from './Touchable';

const Cell = forwardRef((props, ref) => {
  const [number, setNumberState] = useState(props.number);
  const [hints, setHints] = useState([]);
  const [editing, setEditing] = useState(false);
  const [highlight, setHighlightState] = useState(false);
  const [fixed, setFixed] = useState(false);
  const [toggle, setToggle] = useState(false);

  const animRef = useRef(new Animated.Value(0));

  const setHighlight = useCallback((value) => {
    setHighlightState(value);
  }, []);

  const setNumber = useCallback((num, isFixed) => {
    if (!isFixed) LayoutAnimation.easeInEaseOut();
    setNumberState(num);
    setFixed(isFixed);
    setEditing(false);
  }, []);

  const setHintNumber = useCallback((num) => {
    setHints((prevHints) => {
      let next = prevHints.slice();
      if (next.length === 6) next.shift();
      if (next.includes(num)) next = next.filter(x => x !== num);
      else next.push(num);
      return next;
    });
    setEditing(true);
  }, []);

  const reset = useCallback(() => {
    setNumberState(props.number);
    setHints([]);
    setEditing(false);
    setHighlightState(false);
    setFixed(false);
    setToggle(false);
    animRef.current = new Animated.Value(0);
  }, [props.number]);

  const animate = useCallback(() => {
    if (toggle) return;

    setToggle(true);
    animRef.current.setValue(0);

    Animated.sequence([
      Animated.timing(animRef.current, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(animRef.current, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(animRef.current, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(animRef.current, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setToggle(false);
    });
  }, [toggle]);

  // Expose imperative methods to parent (Board uses ref.setHighlight(), etc.)
  useImperativeHandle(ref, () => ({
    setHighlight,
    setNumber,
    setHintNumber,
    reset,
    animate,
  }), [setHighlight, setNumber, setHintNumber, reset, animate]);

  const onPress = useCallback(() => {
    if (props.onPress) {
      props.onPress(props.index, number, fixed);
    }
  }, [props.onPress, props.index, number, fixed]);

  const scale = animRef.current.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.28], // stronger zoom pulse
  });

  const transform = [{ scale }];
  const zIndex = toggle ? 100 : 0;

  const filled = typeof number === 'number';
  const text = filled ? number + 1 : '';
  const hint = hints.map(x => x + 1).join('');

  return (
    <Animated.View
      style={[
        styles.cell,
        filled && styles.filledCell,
        fixed && styles.fixedCell,
        highlight && styles.highlightCell,
        { transform, zIndex },
      ]}
    >
      {editing ? (
        <Text style={[styles.text, styles.editingText]}>{hint}</Text>
      ) : (
        <Text
          style={[
            styles.text,
            fixed && styles.fixedText,
            highlight && styles.highlightText,
          ]}
        >
          {text}
        </Text>
      )}

      <Touchable
        activeOpacity={fixed ? 1 : 0.8}
        onPress={onPress}
        style={styles.handle}
      />
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  handle: {
    width: CellSize,
    height: CellSize,
    position: 'absolute',
    top: 0,
    left: 0,
  },
  cell: {
    width: CellSize,
    height: CellSize,
    backgroundColor: 'lightyellow',
    borderColor: 'orange',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: BorderWidth,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  text: {
    color: '#333',
    fontSize: CellSize * 2 / 3,
    fontFamily: 'HelveticaNeue',
  },
  editingText: {
    textAlign: 'center',
    textAlignVertical: 'center',
    color: 'teal',
    fontSize: CellSize * 2 / 5,
    marginHorizontal: CellSize / 8,
    ...Platform.select({
      ios: {
        marginTop: CellSize / 12,
        lineHeight: CellSize * 2 / 5,
      },
      android: {
        lineHeight: Math.floor(CellSize * 2 / 4),
      },
    }),
  },
  filledCell: {
    backgroundColor: 'moccasin',
  },
  fixedCell: {
    backgroundColor: 'khaki',
  },
  fixedText: {
    color: '#666',
  },
  highlightCell: {
    backgroundColor: 'peru',
  },
  highlightText: {
    color: '#fff',
  },
});

export default Cell;
