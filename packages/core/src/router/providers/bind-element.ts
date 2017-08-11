// Copyright IBM Corp. 2017. All Rights Reserved.
// Node module: @loopback/core
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {Binding, Context, inject, Provider} from '@loopback/context';
import {BindElement} from '../../internal-types';

export class BindElementProvider implements Provider<BindElement> {
  constructor(@inject('http.request.context') protected context: Context) {}

  value() {
    return (key: string) => this.context.bind(key);
  }
}
