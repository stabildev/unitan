import React from 'react';
import {
	ActivityIndicator,
	Button,
	Clipboard,
	Share,
	StyleSheet,
	Text,
  ScrollView,
  Alert,
  Switch,
  TextInput,
  View,
  Keyboard
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import uuid from 'uuid';
import Environment from './config/environment';
import firebase from './config/firebase';

import AsyncStorage from '@react-native-async-storage/async-storage';

const initialState = {
  image: null,
  uploading: false,
  googleResponse: null,

  tanList: [],
  allTans: [],

  settings: false,

  tanFormatNumbers: true,
  tanFormatLowerCase: false,
  tanFormatUpperCase: false,
  tanFormatLength: "6"
};

export default class App extends React.Component {
  state = initialState;

	async componentDidMount() {

    if (false) // set to 'true' to reset app data
      this._storeData();
    else
      await this._getData();

    this._alertIfNecessary();
	}

	render() {
		let { googleResponse, uploading, allTans, tanList, settings, tanFormatNumbers, tanFormatLowerCase, tanFormatUpperCase, tanFormatLength } = this.state;

		return (
			<View style={styles.container}>
        {this._maybeRenderUploadingOverlay()}

        <Text style={styles.logo}>UniTAN</Text>
        <Text style={styles.version}>Version 1.0</Text>

        <View style={styles.contentContainer}>

          { (!googleResponse) && (!settings) && (
          <View>
            <Text style={styles.tanStatus}>Verfügbare TANs: { allTans.length }</Text>
            <Text></Text>
            <Button onPress={this._consumeTan} title="Eine TAN verwenden" disabled={ allTans.length == 0 || uploading}/>

            <View style={styles.separator}/>

            <Button onPress={this._takePhoto} title="TAN-Liste fotografieren" disabled={uploading}/>
            <Button onPress={this._pickImage} title="TAN-Liste aus Aufnahmen hochladen" disabled={uploading}/>

            <View style={styles.separator}/>
            
            <Button onPress={()=>this.setState({settings: true})} title="TAN-Format einstellen" disabled={uploading}/>
            <Button onPress={this._share} title="TAN-Liste exportieren" disabled={uploading || allTans.length == 0 }/>
          </View>
          )}

          { googleResponse && (
            <View style={styles.container, {height: 500}}>
              <Text style={styles.tanStatus}>Erkannte TANs: {tanList.length}</Text>
              <Text></Text>
              <ScrollView style={styles.container}>
                <Text style={styles.tanPreview}>{tanList.join(', ')}</Text>
              </ScrollView>
              <Button title="Übernehmen" onPress={this._addTans} disabled={tanList.length == 0}/>
              <Button title="Abbrechen" onPress={this._clearState} />
          </View>
          )}

          { settings && (
            <View onStartShouldSetResponder={() => Keyboard.dismiss()}>
              <Text style={styles.settingsFormHeading}>TAN-Format:</Text>

              <View style={styles.settingsFormRow}>
                <Switch
                  onValueChange={(newValue) => this.setState({tanFormatNumbers: newValue})}
                  value={tanFormatNumbers}
                />
                <Text style={styles.settingsFormLabel}>Zahlen (0-9)</Text>
              </View>

              <View style={styles.settingsFormRow}>
                <Switch
                  onValueChange={(newValue) => this.setState({tanFormatLowerCase: newValue })}
                  value={tanFormatLowerCase}
                />
                <Text style={styles.settingsFormLabel}>Kleinbuchstaben (a-z)</Text>
              </View>

              <View style={styles.settingsFormRow}>
                <Switch
                  onValueChange={(newValue) => this.setState({tanFormatUpperCase: newValue })}
                  value={tanFormatUpperCase}
                />
                <Text style={styles.settingsFormLabel}>Großbuchstaben (A-Z)</Text>
              </View>

              <View style={styles.settingsFormRow}>
                <TextInput 
                  style={styles.settingsFormInput}
                  value={tanFormatLength}
                  onChangeText={(newValue) => this.setState({ tanFormatLength: newValue })}
                  keyboardType={'number-pad'}
                  maxLength={2}
                  selectTextOnFocus={true}
                />
                <Text style={styles.settingsFormLabel}>Anzahl Zeichen</Text>
              </View>

              <Button
                title={'Übernehmen'}
                onPress={ this._applySettings }
                disabled={ !( tanFormatNumbers || tanFormatLowerCase || tanFormatUpperCase ) || ( tanFormatLength == "" || tanFormatLength == "0" ) }
              />
            </View>
          )}
        </View>
			</View>
		);
  }

	_maybeRenderUploadingOverlay = () => {
		if (this.state.uploading) {
			return (
				<View style={styles.overlay}>
					<ActivityIndicator color="#fff" animating size="large" />
				</View>
			);
		}
	};

  _consumeTan = () => {
    let { allTans } = this.state;
    let consumedTan = allTans.shift();
    Clipboard.setString(consumedTan);
    Alert.alert("Verbrauchte TAN: " + consumedTan, "Die TAN wurde in die Zwischenablage kopiert und aus der Liste der verfügbaren TANs entfernt.");
    this.setState({ allTans: allTans });
    this._storeData();
    this._alertIfNecessary();
  }

  _alertIfNecessary = () => {
    let { allTans } = this.state;
    if (allTans.length < 10)
      Alert.alert('Achtung', 'Nur noch ' + allTans.length + ' TANs verfügbar!');
  }

  _addTans = () => {
    let { tanList, allTans } = this.state;
    this.setState({ ...initialState, allTans: tanList });
    this._storeData();
  }

  _getData = async () => {
    try {
      const value = await AsyncStorage.getItem('@tan_List')
      if(value !== null) {
        let allTans = JSON.parse(value);
        this.setState({ allTans: allTans});
      }

      const value2 = await AsyncStorage.getItem('@tan_Format')
      if(value2 !== null) {
        let [ tanFormatNumbers, tanFormatLowerCase, tanFormatUpperCase, tanFormatLength ] = JSON.parse(value2);
        this.setState({ tanFormatNumbers: tanFormatNumbers });
        this.setState({ tanFormatLowerCase: tanFormatLowerCase });
        this.setState({ tanFormatUpperCase: tanFormatUpperCase });
        this.setState({ tanFormatLength: tanFormatLength });
      }
    } catch(e) {
      alert(e);
    }
  }

  _applySettings = () => {
    this.setState({ settings: false });
    this._storeData();
  }

  _getRegex = () => {
    let { tanFormatNumbers, tanFormatLowerCase, tanFormatUpperCase, tanFormatLength } = this.state;
    let regex = "\\b[" 
              + ( tanFormatNumbers    ? "0-9" : "" ) 
              + ( tanFormatLowerCase  ? "a-z" : "" ) 
              + ( tanFormatUpperCase  ? "A-Z" : "" )
              + "]{" + ( isNaN( parseInt( tanFormatLength ) ) ? 0 : parseInt( tanFormatLength ) )
              + "}\\b";
    return new RegExp( regex, "g" );
  }

  _storeData = async () => {
    let { allTans, tanFormatNumbers, tanFormatLowerCase, tanFormatUpperCase, tanFormatLength } = this.state;
    let tanFormat = [ tanFormatNumbers, tanFormatLowerCase, tanFormatUpperCase, tanFormatLength ];

    try {
      await AsyncStorage.setItem('@tan_List', JSON.stringify(allTans))
      await AsyncStorage.setItem('@tan_Format', JSON.stringify(tanFormat))
    } catch (e) {
      alert(e);
    }
  }
  
  _clearState = () => {
    let { allTans } = this.state;
    this.setState({ ...initialState, allTans: allTans });
  }

	_share = () => {
		Share.share({
			message: 'TAN-Liste\n\n' + this.state.allTans.join('\n')
		});
	};

	_takePhoto = async () => {
		let pickerResult = await ImagePicker.launchCameraAsync();
		this._handleImagePicked(pickerResult);
	};

	_pickImage = async () => {
		let pickerResult = await ImagePicker.launchImageLibraryAsync();
		this._handleImagePicked(pickerResult);
	};

	_handleImagePicked = async pickerResult => {
    if (pickerResult.cancelled)
      return;
		try {
			this.setState({ uploading: true });

			if (!pickerResult.cancelled) {
				let uploadPath = await uploadImageAsync(pickerResult.uri);
        await this.setState({ image: uploadPath });
      }
		} catch (e) {
			console.log(e);
			alert('Upload failed, sorry :(');
		} finally {
      this.setState({ uploading: false });
      this.submitToGoogle();
		}
	};

	submitToGoogle = async () => {
		try {
			this.setState({ uploading: true });
      let { image } = this.state;
			let body = JSON.stringify({
				requests: [
					{
						features: [
							{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 5 },
						],
						image: {
							source: {
								imageUri: image
							}
						}
					}
				]
			});
			let response = await fetch(
				'https://vision.googleapis.com/v1/images:annotate?key=' +
					Environment['GOOGLE_CLOUD_VISION_API_KEY'],
				{
					headers: {
						Accept: 'application/json',
						'Content-Type': 'application/json'
					},
					method: 'POST',
					body: body
				}
			);
			let responseJson = await response.json();
      console.log(responseJson);
			this.setState({
        googleResponse: responseJson,
        tanList: responseJson.responses[0].textAnnotations[0].description.match( this._getRegex() ) || [],
				uploading: false
			});
		} catch (error) {
      console.log(error);
      alert(error);
      this._clearState();
		}
	};
}

async function uploadImageAsync(uri) {
	const blob = await new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.onload = function() {
			resolve(xhr.response);
		};
		xhr.onerror = function(e) {
			console.log(e);
			reject(new TypeError('Network request failed'));
		};
		xhr.responseType = 'blob';
		xhr.open('GET', uri, true);
		xhr.send(null);
	});

	const ref = firebase
		.storage()
		.ref()
		.child(uuid.v4());
	const snapshot = await ref.put(blob);

  blob.close();

	return await "gs://unitan-594b1.appspot.com/" + snapshot.ref.fullPath; //snapshot.ref.getDownloadURL();
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#fff',
		paddingBottom: 10,
	},
	contentContainer: {
    paddingTop: 40,
    paddingHorizontal: 30
  },
  tanStatus: {
    fontSize: 16,
    textAlign: 'center',
    padding: 10,
    borderWidth: 1,
    borderColor: '#CCC'
  },
  tanPreview: { 
    color: 'gray',
    fontFamily: 'Courier'
  },
  separator: {
    width: 20,
    height: 0.5,
    backgroundColor: '#CCC',
    marginVertical: 10,
    alignSelf: 'center'
  },
  settingsFormHeading: {
    fontSize: 20,
    textAlign: 'center',
  },
  settingsFormRow: {
    paddingVertical: 25, 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  settingsFormLabel: {
    paddingLeft: 30, 
    fontSize: 16
  },
  settingsFormInput: {
    fontSize: 20, 
    borderColor: 'gray', 
    borderWidth: 1, 
    paddingHorizontal: 10, 
    paddingVertical: 5, 
    width: 52, 
    textAlign: 'center'
  },
	logo: {
		fontSize: 35,
		color: 'black',
		lineHeight: 24,
    textAlign: 'center',
    paddingTop: 80,
  },
  version: {
    color: 'gray',
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 24
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100
  }
});